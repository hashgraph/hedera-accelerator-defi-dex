// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;
import "./GovernorCountingSimpleInternal.sol";

contract GovernorUpgrade is GovernorCountingSimpleInternal {
    struct TokenUpgradeData {
        address payable proxyContract;
        address contractToUpgrade;
    }

    mapping(uint256 => TokenUpgradeData) _proposalData;

    function createProposal(
        string memory title,
        string memory description,
        string memory linkToDiscussion,
        address payable proxyContract,
        address contractToUpgrade,
        address creator,
        uint256 nftTokenSerialId
    ) public returns (uint256) {
        uint256 proposalId = _createProposal(
            title,
            description,
            linkToDiscussion,
            creator,
            bytes(""),
            nftTokenSerialId
        );
        _proposalData[proposalId] = TokenUpgradeData(
            proxyContract,
            contractToUpgrade
        );
        return proposalId;
    }

    function getContractAddresses(
        uint256 proposalId
    ) public view returns (address, address) {
        require(
            state(proposalId) == ProposalState.Executed,
            "Contract not executed yet!"
        );
        TokenUpgradeData memory tokenUpgradeData = _proposalData[proposalId];
        return (
            tokenUpgradeData.proxyContract,
            tokenUpgradeData.contractToUpgrade
        );
    }
}
