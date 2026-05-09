const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  // Deploy StubZKVerifier
  const StubZKVerifier = await ethers.getContractFactory("StubZKVerifier");
  const verifier = await StubZKVerifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("StubZKVerifier deployed to:", verifierAddress);

  // Deploy ZKRollupPayments
  const ZKRollupPayments = await ethers.getContractFactory("ZKRollupPayments");
  const rollup = await ZKRollupPayments.deploy(verifierAddress, deployer.address);
  await rollup.waitForDeployment();
  const rollupAddress = await rollup.getAddress();
  console.log("ZKRollupPayments deployed to:", rollupAddress);

  const addressesData = {
    network: "localhost",
    chainId: 31337,
    rpcUrl: "http://hardhat:8545",
    ZKRollupPayments: rollupAddress,
    StubZKVerifier: verifierAddress,
    deployedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(addressesData, null, 2));

  // Write addresses to deployments/addresses.json
  // Support both local and Docker volume paths
  const possibleDirs = [
    path.join(__dirname, "../deployments"),
    "/app/deployments",
  ];

  for (const deploymentsDir of possibleDirs) {
    if (!fs.existsSync(deploymentsDir)) {
      try { fs.mkdirSync(deploymentsDir, { recursive: true }); } catch {}
    }
    try {
      fs.writeFileSync(
        path.join(deploymentsDir, "addresses.json"),
        JSON.stringify(addressesData, null, 2)
      );
      console.log(`Deployment info written to ${deploymentsDir}/addresses.json`);
    } catch (e) {
      console.warn(`Could not write to ${deploymentsDir}:`, e.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
