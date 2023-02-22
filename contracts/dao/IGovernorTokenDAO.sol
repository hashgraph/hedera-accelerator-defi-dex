//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "../governance/IGovernorTransferToken.sol";

interface IGovernorTokenDAO {
    function initilize(
        address admin,
        string calldata name,
        string calldata logoUrl,
        IGovernorTransferToken governor
    ) external;

    function getGovernorTokenTransferContractAddress()
        external
        view
        returns (address);

    function getAllProposals() external returns (uint256[] memory);

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
