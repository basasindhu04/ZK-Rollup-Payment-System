const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ZKRollupPayments", function () {
  let rollup, verifier, owner, relayer, userA, userB;

  beforeEach(async function () {
    [owner, relayer, userA, userB] = await ethers.getSigners();

    const StubZKVerifier = await ethers.getContractFactory("StubZKVerifier");
    verifier = await StubZKVerifier.deploy();

    const ZKRollupPayments = await ethers.getContractFactory("ZKRollupPayments");
    rollup = await ZKRollupPayments.deploy(
      await verifier.getAddress(),
      relayer.address
    );
  });

  describe("Deployment", function () {
    it("sets verifier address", async function () {
      expect(await rollup.verifier()).to.equal(await verifier.getAddress());
    });

    it("sets initial state root to zero", async function () {
      expect(await rollup.currentStateRoot()).to.equal(ethers.ZeroHash);
    });

    it("sets initial batch count to 0", async function () {
      expect(await rollup.batchCount()).to.equal(0n);
    });

    it("owner is deployer", async function () {
      expect(await rollup.owner()).to.equal(owner.address);
    });

    it("initial relayer is whitelisted", async function () {
      expect(await rollup.isRelayer(relayer.address)).to.be.true;
    });
  });

  describe("deposit()", function () {
    it("accepts ETH and updates balance", async function () {
      await rollup.connect(userA).deposit({ value: ethers.parseEther("1.0") });
      expect(await rollup.deposits(userA.address)).to.equal(ethers.parseEther("1.0"));
    });

    it("emits Deposited event", async function () {
      await expect(
        rollup.connect(userA).deposit({ value: ethers.parseEther("0.5") })
      )
        .to.emit(rollup, "Deposited")
        .withArgs(userA.address, ethers.parseEther("0.5"), ethers.parseEther("0.5"));
    });

    it("reverts on zero deposit", async function () {
      await expect(
        rollup.connect(userA).deposit({ value: 0 })
      ).to.be.revertedWith("ZKRollup: zero deposit");
    });

    it("accumulates multiple deposits", async function () {
      await rollup.connect(userA).deposit({ value: ethers.parseEther("1.0") });
      await rollup.connect(userA).deposit({ value: ethers.parseEther("0.5") });
      expect(await rollup.deposits(userA.address)).to.equal(ethers.parseEther("1.5"));
    });
  });

  describe("withdraw()", function () {
    beforeEach(async function () {
      await rollup.connect(userA).deposit({ value: ethers.parseEther("1.0") });
    });

    it("allows withdrawal of deposited funds", async function () {
      await rollup.connect(userA).withdraw(ethers.parseEther("0.5"));
      expect(await rollup.deposits(userA.address)).to.equal(ethers.parseEther("0.5"));
    });

    it("emits Withdrawn event", async function () {
      await expect(rollup.connect(userA).withdraw(ethers.parseEther("1.0")))
        .to.emit(rollup, "Withdrawn")
        .withArgs(userA.address, ethers.parseEther("1.0"));
    });

    it("reverts on insufficient balance", async function () {
      await expect(
        rollup.connect(userA).withdraw(ethers.parseEther("2.0"))
      ).to.be.revertedWith("ZKRollup: insufficient balance");
    });
  });

  describe("commitBatch()", function () {
    const newStateRoot = ethers.keccak256(ethers.toUtf8Bytes("new-state"));
    const batchHash = ethers.keccak256(ethers.toUtf8Bytes("batch-hash"));
    const proof = "0x";
    const publicInputs = [];

    it("allows whitelisted relayer to commit", async function () {
      await rollup.connect(relayer).commitBatch(newStateRoot, batchHash, 5, proof, publicInputs);
      expect(await rollup.batchCount()).to.equal(1n);
      expect(await rollup.currentStateRoot()).to.equal(newStateRoot);
    });

    it("emits BatchCommitted event", async function () {
      await expect(
        rollup.connect(relayer).commitBatch(newStateRoot, batchHash, 5, proof, publicInputs)
      )
        .to.emit(rollup, "BatchCommitted")
        .withArgs(0n, newStateRoot, batchHash, 5n, relayer.address);
    });

    it("reverts for non-relayer", async function () {
      await expect(
        rollup.connect(userA).commitBatch(newStateRoot, batchHash, 5, proof, publicInputs)
      ).to.be.revertedWith("ZKRollup: not a relayer");
    });

    it("stores batch record", async function () {
      await rollup.connect(relayer).commitBatch(newStateRoot, batchHash, 5, proof, publicInputs);
      const batch = await rollup.batches(0);
      expect(batch.newStateRoot).to.equal(newStateRoot);
      expect(batch.batchHash).to.equal(batchHash);
      expect(batch.txCount).to.equal(5n);
      expect(batch.relayer).to.equal(relayer.address);
    });
  });

  describe("Relayer management", function () {
    it("owner can add relayer", async function () {
      await rollup.connect(owner).addRelayer(userA.address);
      expect(await rollup.isRelayer(userA.address)).to.be.true;
    });

    it("owner can remove relayer", async function () {
      await rollup.connect(owner).removeRelayer(relayer.address);
      expect(await rollup.isRelayer(relayer.address)).to.be.false;
    });

    it("non-owner cannot add relayer", async function () {
      await expect(
        rollup.connect(userA).addRelayer(userB.address)
      ).to.be.reverted;
    });

    it("non-owner cannot remove relayer", async function () {
      await expect(
        rollup.connect(userA).removeRelayer(relayer.address)
      ).to.be.reverted;
    });
  });
});
