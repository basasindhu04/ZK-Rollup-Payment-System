// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IZKVerifier.sol";

contract ZKRollupPayments is Ownable {
    // State Variables
    address public verifier;
    bytes32 public currentStateRoot;
    uint256 public batchCount;

    struct BatchRecord {
        bytes32 oldStateRoot;
        bytes32 newStateRoot;
        uint256 txCount;
        bytes32 batchHash;
        uint256 committedAt;
        address relayer;
    }

    mapping(uint256 => BatchRecord) public batches;
    mapping(address => uint256) public deposits;
    mapping(address => bool) private relayers;

    // Events
    event Deposited(address indexed user, uint256 amount, uint256 newBalance);
    event BatchCommitted(
        uint256 indexed batchIndex,
        bytes32 newStateRoot,
        bytes32 batchHash,
        uint256 txCount,
        address relayer
    );
    event Withdrawn(address indexed user, uint256 amount);

    constructor(address _verifier, address _initialRelayer) Ownable(msg.sender) {
        verifier = _verifier;
        relayers[_initialRelayer] = true;
        currentStateRoot = bytes32(0);
    }

    modifier onlyRelayer() {
        require(relayers[msg.sender], "ZKRollup: not a relayer");
        _;
    }

    function deposit() external payable {
        require(msg.value > 0, "ZKRollup: zero deposit");
        deposits[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value, deposits[msg.sender]);
    }

    function commitBatch(
        bytes32 newStateRoot,
        bytes32 batchHash,
        uint256 txCount,
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external onlyRelayer {
        bool valid = IZKVerifier(verifier).verifyProof(proof, publicInputs);
        require(valid, "ZKRollup: invalid proof");

        bytes32 oldStateRoot = currentStateRoot;
        currentStateRoot = newStateRoot;

        batches[batchCount] = BatchRecord({
            oldStateRoot: oldStateRoot,
            newStateRoot: newStateRoot,
            txCount: txCount,
            batchHash: batchHash,
            committedAt: block.timestamp,
            relayer: msg.sender
        });

        emit BatchCommitted(batchCount, newStateRoot, batchHash, txCount, msg.sender);
        batchCount++;
    }

    function withdraw(uint256 amount) external {
        require(deposits[msg.sender] >= amount, "ZKRollup: insufficient balance");
        deposits[msg.sender] -= amount;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "ZKRollup: transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    function addRelayer(address relayer) external onlyOwner {
        relayers[relayer] = true;
    }

    function removeRelayer(address relayer) external onlyOwner {
        relayers[relayer] = false;
    }

    function isRelayer(address relayer) external view returns (bool) {
        return relayers[relayer];
    }
}
