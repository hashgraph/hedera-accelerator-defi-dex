// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;
import "./IGovernorBase.sol";

interface IGovernorTransferToken is IGovernorBase  {
    function createProposal(
        string memory title,
        string memory description,
        string memory linkToDiscussion,
        address transferFromAccount,
        address transferToAccount,
        address tokenToTransfer,
        int256 transferTokenAmount,
        address creator
    ) external returns (uint256);

}