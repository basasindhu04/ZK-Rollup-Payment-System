const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const API_BASE = process.env.API_URL || "http://localhost:4000";
const RPC_URL = process.env.RPC_URL || "http://localhost:8545";
const USER_A_PK = process.env.USER_A_PRIVATE_KEY;
const USER_B_ADDRESS = process.env.USER_B_ADDRESS;

const results = [];
let passed = 0;
let failed = 0;

function record(test, status, detail) {
  console.log(`[${status.toUpperCase()}] ${test}: ${detail}`);
  results.push({ test, status, detail });
  if (status === "pass") passed++;
  else failed++;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function poll(fn, timeoutMs = 60000, intervalMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await fn();
    if (result !== null && result !== undefined && result !== false) return result;
    await sleep(intervalMs);
  }
  return null;
}

async function main() {
  console.log("=== ZK Rollup System Validation ===\n");

  // Load deployment addresses
  let addresses;
  try {
    const addressesPath = path.join(__dirname, "../deployments/addresses.json");
    addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
    record("Load deployment addresses", "pass", `Contract: ${addresses.ZKRollupPayments}`);
  } catch (err) {
    record("Load deployment addresses", "fail", err.message);
    writeReport();
    process.exit(1);
  }

  // Connect to chain
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const ROLLUP_ABI = [
    "function deposit() external payable",
    "function deposits(address) external view returns (uint256)",
    "function currentStateRoot() external view returns (bytes32)",
    "function batchCount() external view returns (uint256)",
  ];

  let userA;
  try {
    userA = new ethers.Wallet(USER_A_PK, provider);
    record("Connect wallet USER_A", "pass", `Address: ${userA.address}`);
  } catch (err) {
    record("Connect wallet USER_A", "fail", err.message);
    writeReport();
    process.exit(1);
  }

  const rollup = new ethers.Contract(addresses.ZKRollupPayments, ROLLUP_ABI, userA);

  // Test 1: Deposit 0.5 ETH
  try {
    const tx = await rollup.deposit({ value: ethers.parseEther("0.5") });
    await tx.wait();
    record("Deposit 0.5 ETH on-chain", "pass", `tx: ${tx.hash}`);
  } catch (err) {
    record("Deposit 0.5 ETH on-chain", "fail", err.message);
  }

  // Test 2: Poll for deposit indexing
  const indexed = await poll(async () => {
    const { status, body } = await apiFetch(`/deposits/${userA.address}`);
    if (status === 200 && BigInt(body.balanceWei || "0") > 0n) return body;
    return false;
  }, 60000);

  if (indexed) {
    record("Deposit indexed by API", "pass", `Balance: ${indexed.balanceEth} ETH`);
  } else {
    record("Deposit indexed by API", "fail", "Deposit not reflected in API within 60s");
  }

  // Test 3: Submit valid payment intent (0.1 ETH)
  const toAddress = USER_B_ADDRESS || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const validAmountWei = ethers.parseEther("0.1").toString();
  let intentId;
  {
    const { status, body } = await apiFetch("/intents", {
      method: "POST",
      body: JSON.stringify({
        fromAddress: userA.address,
        toAddress,
        amountWei: validAmountWei,
      }),
    });
    if (status === 201 && body.intentId) {
      intentId = body.intentId;
      record("Submit valid intent (0.1 ETH)", "pass", `intentId: ${intentId}`);
    } else {
      record("Submit valid intent (0.1 ETH)", "fail", JSON.stringify(body));
    }
  }

  // Test 4: Submit invalid payment intent (999 ETH) - should fail
  {
    const { status, body } = await apiFetch("/intents", {
      method: "POST",
      body: JSON.stringify({
        fromAddress: userA.address,
        toAddress,
        amountWei: ethers.parseEther("999").toString(),
      }),
    });
    if (status === 400 && body.error) {
      record("Reject invalid intent (999 ETH)", "pass", `Error: ${body.error}`);
    } else {
      record("Reject invalid intent (999 ETH)", "fail", `Got status ${status}: ${JSON.stringify(body)}`);
    }
  }

  // Test 5: Wait for relayer to process batch
  if (intentId) {
    const initialState = await apiFetch("/state");
    const initialBatchCount = initialState.body.batchCount || 0;

    const batchProcessed = await poll(async () => {
      const { body } = await apiFetch(`/intents?address=${userA.address}`);
      const intent = (body.intents || []).find((i) => i.id === intentId);
      if (intent && (intent.status === "batched" || intent.status === "committed")) {
        return intent;
      }
      return false;
    }, 60000, 4000);

    if (batchProcessed) {
      record(
        "Relayer processes intent into batch",
        "pass",
        `Intent status: ${batchProcessed.status}`
      );
    } else {
      record("Relayer processes intent into batch", "fail", "Intent not batched within 60s");
    }

    // Test 6: Batch count increased
    const newState = await apiFetch("/state");
    const newBatchCount = newState.body.batchCount || 0;
    if (newBatchCount > initialBatchCount) {
      record("Batch count increased on-chain", "pass", `Count: ${newBatchCount}`);
    } else {
      record("Batch count increased on-chain", "fail", `Still ${newBatchCount}`);
    }
  }

  // Test 7: Batches list is populated
  {
    const { status, body } = await apiFetch("/batches");
    if (status === 200 && Array.isArray(body.batches) && body.batches.length > 0) {
      record("GET /batches returns data", "pass", `${body.batches.length} batch(es)`);

      // Test 8: Batch detail
      const batchIndex = body.batches[0].batch_index;
      const { status: s2, body: b2 } = await apiFetch(`/batches/${batchIndex}`);
      if (s2 === 200 && b2.batch) {
        record("GET /batches/:index returns detail", "pass", `batchIndex: ${batchIndex}`);
      } else {
        record("GET /batches/:index returns detail", "fail", JSON.stringify(b2));
      }
    } else {
      record("GET /batches returns data", "fail", "No batches found");
    }
  }

  // Test 9: State endpoint
  {
    const { status, body } = await apiFetch("/state");
    if (status === 200 && body.contractAddress && body.currentStateRoot) {
      record("GET /state returns valid data", "pass", `batchCount: ${body.batchCount}`);
    } else {
      record("GET /state returns valid data", "fail", JSON.stringify(body));
    }
  }

  writeReport();
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

function writeReport() {
  const report = { passed, failed, results };
  const reportPath = path.join(__dirname, "../validation_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nValidation report written to: ${reportPath}`);
}

main().catch((err) => {
  console.error("Fatal validation error:", err);
  record("Validation script execution", "fail", err.message);
  writeReport();
  process.exit(1);
});
