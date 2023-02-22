// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

interface IGovernorTransferToken {
    function createProposal(
        string memory title,
        string memory description,
        string memory linkToDiscussion,
        address transferFromAccount,
        address transferToAccount,
        address tokenToTransfer,
        int256 transferTokenAmount
    ) external returns (uint256);
}
