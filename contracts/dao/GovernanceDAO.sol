//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;
import "./ITokenDAO.sol";
import "./BaseDAO.sol";

contract GovernorTokenDAO is ITokenDAO, BaseDAO {
    IGovernorTransferToken private governorTokenTransferAddress;
    uint256[] private _proposals;

    function initialize(
        address _admin,
        string memory _name,
        string memory _logoUrl,
        string memory _description,
        string[] memory _webLinks,
        IGovernorTransferToken governor
    ) external override initializer {
        governorTokenTransferAddress = governor;
        __BaseDAO_init(_admin, _name, _logoUrl, _description, _webLinks);
    }

    function getGovernorTokenTransferContractAddress()
        external
        view
        override
        returns (address)
    {
        return address(governorTokenTransferAddress);
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
        string memory _title,
        string memory _description,
        string memory _linkToDiscussion,
        address _transferFromAccount,
        address _transferToAccount,
        address _tokenToTransfer,
        uint256 _transferTokenAmount
    ) external override onlyOwner returns (uint256) {
        uint256 proposalId = governorTokenTransferAddress.createProposal(
            _title,
            _description,
            _linkToDiscussion,
            _transferFromAccount,
            _transferToAccount,
            _tokenToTransfer,
            _transferTokenAmount,
            msg.sender
        );
        _proposals.push(proposalId);
        return proposalId;
    }
}
