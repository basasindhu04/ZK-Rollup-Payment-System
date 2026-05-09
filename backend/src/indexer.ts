import { ethers } from "ethers";
import { pool } from "./db";
import { getProvider, getRollupContract } from "./blockchain";

export async function startIndexer(): Promise<void> {
  console.log("[Indexer] Starting event listeners...");

  const provider = getProvider();
  const contract = getRollupContract(provider);

  // Listen for Deposited events
  contract.on("Deposited", async (user: string, amount: bigint, newBalance: bigint, event: any) => {
    try {
      const txHash = event.log?.transactionHash || event.transactionHash || "";
      const blockNumber = event.log?.blockNumber || event.blockNumber || 0;
      console.log(`[Indexer] Deposited: user=${user}, amount=${amount.toString()}`);

      await pool.query(
        `INSERT INTO deposits (user_address, amount_wei, tx_hash, block_number)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [user.toLowerCase(), amount.toString(), txHash, blockNumber]
      );
    } catch (err) {
      console.error("[Indexer] Error handling Deposited event:", err);
    }
  });

  // Listen for BatchCommitted events
  contract.on(
    "BatchCommitted",
    async (
      batchIndex: bigint,
      newStateRoot: string,
      batchHash: string,
      txCount: bigint,
      relayer: string,
      event: any
    ) => {
      try {
        const txHash = event.log?.transactionHash || event.transactionHash || "";
        console.log(`[Indexer] BatchCommitted: batchIndex=${batchIndex.toString()}`);

        await pool.query(
          `INSERT INTO batches (batch_index, new_state_root, batch_hash, tx_count, relayer_address, committed_at, tx_hash)
           VALUES ($1, $2, $3, $4, $5, NOW(), $6)
           ON CONFLICT (batch_index) DO UPDATE SET
             committed_at = NOW(),
             tx_hash = EXCLUDED.tx_hash,
             new_state_root = EXCLUDED.new_state_root`,
          [
            Number(batchIndex),
            newStateRoot,
            batchHash,
            Number(txCount),
            relayer.toLowerCase(),
            txHash,
          ]
        );
      } catch (err) {
        console.error("[Indexer] Error handling BatchCommitted event:", err);
      }
    }
  );

  // Listen for Withdrawn events
  contract.on("Withdrawn", (user: string, amount: bigint) => {
    console.log(`[WITHDRAW] address=${user} amount=${amount.toString()}`);
  });

  // Handle provider errors / reconnect
  provider.on("error", (err: any) => {
    console.error("[Indexer] Provider error:", err);
  });

  console.log("[Indexer] Event listeners active.");
}
