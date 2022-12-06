// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/governance/GovernorUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/IGovernorUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorSettingsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol";
import "./IERC20.sol";
import "./IBaseHTS.sol";
import "./hedera/HederaResponseCodes.sol";
import "./GovernorCountingSimpleUpgradeable.sol";

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

    function initialize(
        IERC20 _token,
        uint256 _votingDelayValue,
        uint256 _votingPeriodValue,
        IBaseHTS _tokenService
    ) public initializer {
        tokenService = _tokenService;
        token = _token;
        precision = 100000000;
        __Governor_init("HederaTokenCreateGovernor");
        __GovernorSettings_init(
            _votingDelayValue, /* 1 block */
            _votingPeriodValue, /* 1 week */
            0
        );
        __GovernorCountingSimple_init();
    }


    function mockFunctionCall()
        internal
        pure
        returns (
            address[] memory targets,
            uint256[] memory values,
            bytes[] memory calldatas
        )
    {
        targets = new address[](1);
        targets[0] = (address(0));
        values = new uint256[](1);
        values[0] = (0);
        calldatas = new bytes[](1);
        bytes memory b = "blank";
        calldatas[0] = (b);
    }

    mapping(address => VotingWeight) votingWeights;

    /**
     * Using below array for delegation tracking and checking if already delegated.
     * Its not efficient but saving another state variable. Also, not expecting delegaters
     * would be too many.
     */
    address[] delegaters;
    address[] voters;

    mapping(address => Delegation) delegation;

    struct VotingWeight {
        uint256 weight;
        uint8 support;
    }

    struct Delegation {
        address delegatee;
        address delegator;
    }

    function getDelegatorIndex(
        address delegator
    ) private view returns (int256) {
        for (uint256 i = 0; i < delegaters.length; i++) {
            if (delegaters[i] == delegator) {
                return int256(i);
            }
        }
        return -1;
    }

    function delegateTo(address delegatee) external {
        address delegator = _msgSender();
        require(
            delegation[delegator].delegatee == address(0x0),
            "Delegatee cannot delegate further."
        );
        int256 index = getDelegatorIndex(delegator);
        require(index == -1, "Delegator already delegated.");
        delegation[delegatee] = Delegation(delegatee, delegator);
        delegaters.push(delegator);
    }

    function isDelegated(address account) private view returns (bool) {
        return delegation[account].delegatee != address(0x0);
    }

    function _getVotes(
        address account,
        uint256,
        bytes memory /*params*/
    ) internal view virtual override returns (uint256) {
        address userAccount = account;
        if (isDelegated(account)) {
            userAccount = delegation[account].delegator;
        }
        uint256 share = (token.balanceOf(userAccount) * precision) /
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
        uint256 proposalId = super.propose(
            targets,
            values,
            calldatas,
            description
        );
        proposalCreators[proposalId] = msg.sender;
        return proposalId;
    }

    function getGODToken() internal {
        tokenService.associateTokenPublic(address(this), address(token));
        int256 responseCode = tokenService.transferTokenPublic(
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
        int256 responseCode = tokenService.transferTokenPublic(
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
        string memory description
    ) public returns (uint256 proposalId) {
        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas) = mockFunctionCall();
        bytes32 descriptionHash = keccak256(bytes(description));
        proposalId = hashProposal(targets, values, calldatas, descriptionHash);
        require(
            proposalCreators[proposalId] != address(0),
            "Proposal not found"
        );
        require(
            msg.sender == proposalCreators[proposalId],
            "Only proposer can cancel the proposal"
        );
        proposalId = super._cancel(targets, values, calldatas, descriptionHash);
        returnGODToken(proposalId);
    }

    /**
     * @dev See {IGovernor-execute}.
     */
    function executeProposal(
        string memory description
    ) public payable virtual returns (uint256) {
        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas) = mockFunctionCall();
        bytes32 descriptionHash = keccak256(bytes(description));
        uint256 proposalId = hashProposal(
            targets,
            values,
            calldatas,
            descriptionHash
        );
        adjustIfVoterTokenBalanceChanged(proposalId, voters);
        adjustIfVoterTokenBalanceChanged(proposalId, delegaters);
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
        uint256 proposalId /* proposalId */,
        address[] memory,
        uint256[] memory,
        bytes[] memory,
        bytes32 /*descriptionHash*/
    ) internal virtual override {
        returnGODToken(proposalId);
    }

    /**
     * @dev See {IGovernor-castVote}.
     */
    function castVote(
        uint256 proposalId,
        uint8 support
    ) public virtual override returns (uint256) {
        address voter = _msgSender();
        int256 delegatorIndex = getDelegatorIndex(voter);
        bool noDelegation = (delegatorIndex == -1);

        require(noDelegation, "Delegator already delegated.");

        require(noDelegation && _getVotes(voter, 0, "") > 0, "No voting power");

        uint256 weight = _castVote(proposalId, voter, support, "");

        removeExistingVotingWeight(proposalId);

        adjustIfVoterTokenBalanceChanged(proposalId, voters);

        VotingWeight memory userWeight = VotingWeight(weight, support);
        votingWeights[voter] = userWeight;

        voters.push(voter);

        if (delegatorIndex >= 0) {
            votingWeights[delegaters[uint256(delegatorIndex)]].support = 0;
            votingWeights[delegaters[uint256(delegatorIndex)]].weight = 0;
        }

        return weight;
    }

    function adjustIfVoterTokenBalanceChanged(
        uint256 proposalId,
        address[] memory localVoters
    ) private {
        for (uint256 i = 0; i < localVoters.length; i++) {
            address voter = localVoters[i];
            VotingWeight memory existingVotedWeight = votingWeights[voter];
            int256 adjustedWeight = getTokenBalanceChanged(
                voter,
                existingVotedWeight.weight
            );
            if (hasVoted(proposalId, voter)) {
                adjustVote(
                    proposalId,
                    voter,
                    existingVotedWeight.support,
                    adjustedWeight,
                    ""
                );
            }
        }
    }

    function removeExistingVotingWeight(uint256 proposalId) private {
        for (uint256 i = 0; i < delegaters.length; i++) {
            address delegator = delegaters[i];
            VotingWeight memory existingVotedWeight = votingWeights[delegator];
            if (hasVoted(proposalId, delegator)) {
                adjustVote(
                    proposalId,
                    delegator,
                    existingVotedWeight.support,
                    -1 * int256(existingVotedWeight.weight),
                    ""
                );
            }
        }
    }

    function getTokenBalanceChanged(
        address voter,
        uint256 existingWeight
    ) private view returns (int256) {
        uint256 currentWeight = _getVotes(voter, 0, "");
        return int256(currentWeight) - int256(existingWeight);
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
