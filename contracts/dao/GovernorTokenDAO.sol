//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./IGovernorTokenDAO.sol";
import "./BaseDAO.sol";

contract GovernorTokenDAO is IGovernorTokenDAO, BaseDAO {
    IGovernorTransferToken private _governorTokenTransferAddress;
    uint256[] private _proposals;

    function initialize(
        address admin,
        string calldata name,
        string calldata logoUrl,
        IGovernorTransferToken governorTokenTransferContractAddress
    ) external override initializer {
        _governorTokenTransferAddress = governorTokenTransferContractAddress;
        __BaseDAO_init(admin, name, logoUrl);
    }

    function getGovernorTokenTransferContractAddress()
        external
        view
        override
        returns (address)
    {
        return address(_governorTokenTransferAddress);
    }

    function getAllProposals()
        external
        view
        override
        returns (uint256[] memory)
    {
        return _proposals;
    }

    function createProposal(
        string memory title,
        string memory description,
        string memory linkToDiscussion,
        address transferFromAccount,
        address transferToAccount,
        address tokenToTransfer,
        int256 transferTokenAmount
    ) external override onlyOwner returns (uint256) {
        uint256 proposalId = _governorTokenTransferAddress.createProposal(
            title,
            description,
            linkToDiscussion,
            transferFromAccount,
            transferToAccount,
            tokenToTransfer,
            transferTokenAmount,
            msg.sender
        );
        _proposals.push(proposalId);
        return proposalId;
    }
}
