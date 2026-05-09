import { ethers } from "ethers";
import fs from "fs";
import path from "path";

let provider: ethers.JsonRpcProvider;
let rollupContract: ethers.Contract;
let relayerWallet: ethers.Wallet;

const ROLLUP_ABI = [
  "function deposit() external payable",
  "function commitBatch(bytes32 newStateRoot, bytes32 batchHash, uint256 txCount, bytes calldata proof, uint256[] calldata publicInputs) external",
  "function withdraw(uint256 amount) external",
  "function deposits(address) external view returns (uint256)",
  "function currentStateRoot() external view returns (bytes32)",
  "function batchCount() external view returns (uint256)",
  "function batches(uint256) external view returns (bytes32 oldStateRoot, bytes32 newStateRoot, uint256 txCount, bytes32 batchHash, uint256 committedAt, address relayer)",
  "function isRelayer(address) external view returns (bool)",
  "function addRelayer(address) external",
  "event Deposited(address indexed user, uint256 amount, uint256 newBalance)",
  "event BatchCommitted(uint256 indexed batchIndex, bytes32 newStateRoot, bytes32 batchHash, uint256 txCount, address relayer)",
  "event Withdrawn(address indexed user, uint256 amount)",
];

export function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    const rpcUrl = process.env.RPC_URL || "http://hardhat:8545";
    provider = new ethers.JsonRpcProvider(rpcUrl);
  }
  return provider;
}

export function getAddresses(): any {
  const candidates = [
    "/app/deployments/addresses.json",                          // Docker volume path
    path.join(__dirname, "../../deployments/addresses.json"),   // Local dev path
    path.join(process.cwd(), "deployments/addresses.json"),     // CWD fallback
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    }
  }
  throw new Error(
    `deployments/addresses.json not found. Looked in:\n${candidates.join("\n")}`
  );
}

export function getRollupContract(signerOrProvider?: ethers.Signer | ethers.Provider): ethers.Contract {
  const addresses = getAddresses();
  const p = signerOrProvider || getProvider();
  if (!rollupContract || signerOrProvider) {
    return new ethers.Contract(addresses.ZKRollupPayments, ROLLUP_ABI, p);
  }
  return rollupContract;
}

export function getRelayerWallet(): ethers.Wallet {
  if (!relayerWallet) {
    const pk = process.env.RELAYER_PRIVATE_KEY;
    if (!pk) throw new Error("RELAYER_PRIVATE_KEY not set");
    relayerWallet = new ethers.Wallet(pk, getProvider());
  }
  return relayerWallet;
}

export async function waitForRPC(retries = 20, delay = 3000): Promise<void> {
  const rpcUrl = process.env.RPC_URL || "http://hardhat:8545";
  for (let i = 0; i < retries; i++) {
    try {
      const p = new ethers.JsonRpcProvider(rpcUrl);
      await p.getBlockNumber();
      console.log("[RPC] Connected to blockchain node.");
      return;
    } catch {
      console.log(`[RPC] Waiting for blockchain node... (${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("[RPC] Could not connect to blockchain node.");
}
