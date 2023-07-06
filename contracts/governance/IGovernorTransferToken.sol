// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;
import "./IGovernorBase.sol";

interface IGovernorTransferToken is IGovernorBase {
    function createProposal(
        string memory title,
        string memory description,
        string memory linkToDiscussion,
        address transferFromAccount,
        address transferToAccount,
        address tokenToTransfer,
        uint256 transferTokenAmount,
        address creator,
        uint256 nftTokenSerialId
    ) external returns (uint256);

    function upgradeHederaService(IHederaService newHederaService) external;

    function getHederaServiceVersion() external view returns (IHederaService);
}
