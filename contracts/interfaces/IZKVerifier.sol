// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

interface IZKVerifier {
    function verifyProof(
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external view returns (bool);
}
