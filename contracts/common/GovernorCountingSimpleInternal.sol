// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/governance/GovernorUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/IGovernorUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorSettingsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorCountingSimpleUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol";
import "./IERC20.sol";
import "./IBaseHTS.sol";
import "./hedera/HederaResponseCodes.sol";
import "hardhat/console.sol";
 

abstract contract GovernorCountingSimpleInternal is
    Initializable,
    GovernorUpgradeable,
    GovernorSettingsUpgradeable,
    GovernorCountingSimpleUpgradeable,
    HederaResponseCodes
{
    uint256 precision;
    IERC20 token;
    mapping(uint256 => address) proposalCreators;
    IBaseHTS internal tokenService;

    function mockFunctionCall() pure internal returns (
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas) {
           targets = new address[](1);
           targets[0] = (address(0));
           values = new uint256[](1);
           values[0] = (0);
           calldatas = new bytes[](1);
           bytes memory b = "blank";
           calldatas[0] = (b);
    }

    function _getVotes(
        address account,
        uint256,
        bytes memory /*params*/
    ) internal view virtual override returns (uint256) {
        uint256 share = (token.balanceOf(account) * precision) /
            token.totalSupply();
        uint256 percentageShare = share / (precision / 100);
        return percentageShare;
    }

    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public virtual override returns (uint256) { 
        getGODToken();
        uint256 proposalId = super.propose(targets, values, calldatas, description);
        proposalCreators[proposalId] = msg.sender;
        return proposalId;
    }

    function getGODToken() internal {
        tokenService.associateTokenPublic(address(this), address(token));
        int responseCode = tokenService.transferTokenPublic(
            address(token),
            address(msg.sender),
            address(this),
            int64(uint64(precision))
        );
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Transfer token failed.");
        }
    }

    function returnGODToken(uint256 proposalId) internal {
        int responseCode = tokenService.transferTokenPublic(
            address(token),
            address(this),
            address(proposalCreators[proposalId]),
            int64(uint64(precision))
        );
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Transfer token failed.");
        }
    }

    function votingDelay()
        public
        view
        override(IGovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(IGovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function proposalThreshold()
        public
        view
        override(GovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    function cancelProposal(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public returns (uint256 proposalId) {
        bytes32 descriptionHash = keccak256(bytes(description));
        proposalId = hashProposal(targets, values, calldatas, descriptionHash);
        require(proposalCreators[proposalId] != address(0), "Proposal not found");
        require(msg.sender == proposalCreators[proposalId], "Only proposer can cancel the proposal");
        proposalId = super._cancel(targets, values, calldatas, descriptionHash);
        returnGODToken(proposalId);
    }

    /**
     * @dev See {IGovernor-execute}.
     */
    function executePublic(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public payable virtual returns (uint256) {
        bytes32 descriptionHash = keccak256(bytes(description));
        return execute(targets, values, calldatas, descriptionHash);
    }

    /**
     * @dev See {Governor-_quorumReached}.
     */
    function quorumReached(uint256 proposalId) external view returns (bool) {
        return super._quorumReached(proposalId);
    }

    /**
     * @dev See {Governor-_voteSucceeded}. In this module, the forVotes must be strictly over the againstVotes.
     */
    function voteSucceeded(uint256 proposalId) external view returns (bool) {
        return super._voteSucceeded(proposalId);
    }

    /**
     * @dev Internal execution mechanism. Can be overridden to implement different execution mechanism
     */
    function _execute(
        uint256 proposalId, /* proposalId */
        address[] memory,
        uint256[] memory,
        bytes[] memory,
        bytes32 /*descriptionHash*/
    ) internal virtual override {
        returnGODToken(proposalId);
    }
}

library Bits {
    uint256 internal constant ONE = uint256(1);

    // Sets the bit at the given 'index' in 'self' to '1'.
    // Returns the modified value.
    function setBit(uint256 self, uint8 index) internal pure returns (uint256) {
        return self | (ONE << index);
    }
}
