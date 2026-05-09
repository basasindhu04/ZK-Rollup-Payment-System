import { ethers } from "ethers";
import { pool } from "./db";
import { getRollupContract, getRelayerWallet } from "./blockchain";

const BATCH_INTERVAL_MS = 15000;
const MAX_BATCH_SIZE = 10;

async function processBatch(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Fetch pending intents (lock rows)
    const result = await client.query(
      `SELECT * FROM payment_intents
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [MAX_BATCH_SIZE]
    );

    const intents = result.rows;
    if (intents.length === 0) {
      await client.query("ROLLBACK");
      return;
    }

    console.log(`[Relayer] Processing ${intents.length} pending intent(s)...`);

    // Compute batchHash from intent IDs
    const intentIds = intents.map((i: any) => i.id);
    const encodedIds = ethers.AbiCoder.defaultAbiCoder().encode(
      ["string[]"],
      [intentIds]
    );
    const batchHash = ethers.keccak256(encodedIds);

    // Get current state root from contract
    const wallet = getRelayerWallet();
    const contract = getRollupContract(wallet);
    const currentStateRoot: string = await contract.currentStateRoot();

    // Compute new state root
    const newStateRoot = ethers.keccak256(
      ethers.concat([
        ethers.getBytes(currentStateRoot),
        ethers.getBytes(batchHash),
      ])
    );

    // Dummy proof for stub verifier
    const proof = "0x";
    const publicInputs: bigint[] = [];

    let txHash: string | null = null;
    let success = false;

    try {
      const tx = await contract.commitBatch(
        newStateRoot,
        batchHash,
        intents.length,
        proof,
        publicInputs
      );
      const receipt = await tx.wait();
      txHash = receipt.hash;
      success = true;
      console.log(`[Relayer] Batch committed on-chain. txHash=${txHash}`);
    } catch (err: any) {
      console.error("[Relayer] Failed to commit batch:", err.message || err);
    }

    if (success) {
      // Get new batch count to find batch_index
      const batchCount: bigint = await contract.batchCount();
      const batchIndex = Number(batchCount) - 1;

      // Insert batch record
      const batchResult = await client.query(
        `INSERT INTO batches (batch_index, old_state_root, new_state_root, batch_hash, tx_count, relayer_address, tx_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (batch_index) DO UPDATE SET
           tx_hash = EXCLUDED.tx_hash,
           new_state_root = EXCLUDED.new_state_root
         RETURNING id`,
        [
          batchIndex,
          currentStateRoot,
          newStateRoot,
          batchHash,
          intents.length,
          wallet.address.toLowerCase(),
          txHash,
        ]
      );

      const batchDbId = batchResult.rows[0]?.id;

      // Update intents to batched
      await client.query(
        `UPDATE payment_intents
         SET status = 'batched', batch_id = $1, updated_at = NOW()
         WHERE id = ANY($2::uuid[])`,
        [batchDbId, intentIds]
      );

      console.log(`[Relayer] Updated ${intents.length} intents to 'batched', batchIndex=${batchIndex}`);
    } else {
      // Mark as failed
      await client.query(
        `UPDATE payment_intents
         SET status = 'failed', updated_at = NOW()
         WHERE id = ANY($1::uuid[])`,
        [intentIds]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Relayer] Batch processing error:", err);
  } finally {
    client.release();
  }
}

export function startRelayer(): void {
  console.log(`[Relayer] Starting. Batch interval: ${BATCH_INTERVAL_MS}ms`);
  
  // Run once after short delay then on interval
  setTimeout(async () => {
    await processBatch();
    setInterval(processBatch, BATCH_INTERVAL_MS);
  }, 5000);
}
