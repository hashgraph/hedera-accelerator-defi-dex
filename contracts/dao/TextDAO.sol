//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;
import "./IGovernanceDAO.sol";
import "./BaseDAO.sol";
import "../governance/GovernorTextProposal.sol";

contract TextDAO is IGovernanceDAO, BaseDAO {
    GovernorTextProposal private governorTextProposal;
    uint256[] private _proposals;

    function initialize(
        address _admin,
        string memory _name,
        string memory _logoUrl,
        string memory _description,
        string[] memory _webLinks,
        address payable governor
    ) external override initializer {
        governorTextProposal = GovernorTextProposal(governor);
        __BaseDAO_init(_admin, _name, _logoUrl, _description, _webLinks);
    }

    function getGovernorContractAddress()
        external
        view
        override
        returns (address)
    {
        return address(governorTextProposal);
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
        string memory _linkToDiscussion
    ) external onlyOwner returns (uint256) {
        uint256 proposalId = governorTextProposal.createProposal(
            _title,
            _description,
            _linkToDiscussion,
            msg.sender
        );
        _proposals.push(proposalId);
        return proposalId;
    }
}
