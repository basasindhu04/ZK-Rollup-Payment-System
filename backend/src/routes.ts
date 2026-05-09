import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { pool } from "./db";
import { getProvider, getRollupContract, getAddresses } from "./blockchain";

const router = Router();

// POST /intents - Submit a new payment intent
router.post("/intents", async (req: Request, res: Response) => {
  try {
    const { fromAddress, toAddress, amountWei } = req.body;

    if (!fromAddress || !toAddress || !amountWei) {
      return res.status(400).json({ error: "Missing required fields: fromAddress, toAddress, amountWei" });
    }

    if (!ethers.isAddress(fromAddress) || !ethers.isAddress(toAddress)) {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }

    // Check on-chain balance
    const contract = getRollupContract(getProvider());
    const balance: bigint = await contract.deposits(fromAddress);
    const amount = BigInt(amountWei);

    if (balance < amount) {
      return res.status(400).json({ error: "Insufficient on-chain deposit" });
    }

    // Insert intent
    const result = await pool.query(
      `INSERT INTO payment_intents (from_address, to_address, amount_wei, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [fromAddress.toLowerCase(), toAddress.toLowerCase(), amountWei.toString()]
    );

    const intent = result.rows[0];
    return res.status(201).json({
      intentId: intent.id,
      status: intent.status,
      fromAddress: intent.from_address,
      toAddress: intent.to_address,
      amountWei: intent.amount_wei,
      createdAt: intent.created_at,
    });
  } catch (err: any) {
    console.error("[API] POST /intents error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /intents - List payment intents
router.get("/intents", async (req: Request, res: Response) => {
  try {
    const { address, status } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (address) {
      conditions.push(`from_address = $${idx++}`);
      params.push((address as string).toLowerCase());
    }
    if (status) {
      conditions.push(`status = $${idx++}`);
      params.push(status as string);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
      `SELECT * FROM payment_intents ${where} ORDER BY created_at DESC`,
      params
    );

    return res.json({ intents: result.rows });
  } catch (err: any) {
    console.error("[API] GET /intents error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /batches - List all batches
router.get("/batches", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM batches ORDER BY batch_index ASC"
    );
    return res.json({ batches: result.rows });
  } catch (err: any) {
    console.error("[API] GET /batches error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /batches/:batchIndex - Get batch details with intents
router.get("/batches/:batchIndex", async (req: Request, res: Response) => {
  try {
    const batchIndex = parseInt(req.params.batchIndex);
    const batchResult = await pool.query(
      "SELECT * FROM batches WHERE batch_index = $1",
      [batchIndex]
    );

    if (batchResult.rows.length === 0) {
      return res.status(404).json({ error: "Batch not found" });
    }

    const batch = batchResult.rows[0];
    const intentsResult = await pool.query(
      "SELECT * FROM payment_intents WHERE batch_id = $1",
      [batch.id]
    );

    return res.json({ batch, intents: intentsResult.rows });
  } catch (err: any) {
    console.error("[API] GET /batches/:batchIndex error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /deposits/:address - Get deposit balance
router.get("/deposits/:address", async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }

    const contract = getRollupContract(getProvider());
    const balanceWei: bigint = await contract.deposits(address);

    return res.json({
      address,
      balanceWei: balanceWei.toString(),
      balanceEth: ethers.formatEther(balanceWei),
    });
  } catch (err: any) {
    console.error("[API] GET /deposits/:address error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /state - Get rollup state
router.get("/state", async (_req: Request, res: Response) => {
  try {
    const contract = getRollupContract(getProvider());
    const [currentStateRoot, batchCount] = await Promise.all([
      contract.currentStateRoot(),
      contract.batchCount(),
    ]);

    const addresses = getAddresses();

    return res.json({
      currentStateRoot,
      batchCount: Number(batchCount),
      contractAddress: addresses.ZKRollupPayments,
    });
  } catch (err: any) {
    console.error("[API] GET /state error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
