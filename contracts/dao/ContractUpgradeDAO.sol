//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;
import "./IGovernanceDAO.sol";
import "./BaseDAO.sol";
import "../governance/GovernorUpgrade.sol";

contract ContractUpgradeDAO is IGovernanceDAO, BaseDAO {
    GovernorUpgrade private governorUpgrade;
    uint256[] private _proposals;
    address systemUser;

    function initialize(
        address _admin,
        string memory _name,
        string memory _logoUrl,
        string memory _description,
        string[] memory _webLinks,
        address payable governor
    ) external override initializer {
        systemUser = msg.sender;
        governorUpgrade = GovernorUpgrade(governor);
        __BaseDAO_init(_admin, _name, _logoUrl, _description, _webLinks);
    }

    function getGovernorContractAddress()
        external
        view
        override
        returns (address)
    {
        return address(governorUpgrade);
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
        address payable _proxyContract,
        address _contractToUpgrade
    ) external onlyOwner returns (uint256) {
        uint256 proposalId = governorUpgrade.createProposal(
            _title,
            _description,
            _linkToDiscussion,
            _proxyContract,
            _contractToUpgrade,
            msg.sender
        );
        _proposals.push(proposalId);
        return proposalId;
    }
}
