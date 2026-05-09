// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "./interfaces/IZKVerifier.sol";

contract StubZKVerifier is IZKVerifier {
    function verifyProof(
        bytes calldata /* proof */,
        uint256[] calldata /* publicInputs */
    ) external pure override returns (bool) {
        return true;
    }
}
