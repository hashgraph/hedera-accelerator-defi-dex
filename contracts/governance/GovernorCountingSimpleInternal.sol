// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/governance/GovernorUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/IGovernorUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorSettingsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorCountingSimpleUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol";
import "../common/IERC20.sol";
import "../common/IBaseHTS.sol";
import "../common/hedera/HederaResponseCodes.sol";
import "./GODHolder.sol";

abstract contract GovernorCountingSimpleInternal is
    Initializable,
    GovernorUpgradeable,
    GovernorSettingsUpgradeable,
    GovernorCountingSimpleUpgradeable
{
    struct ProposalInfo {
        address creator;
        string title;
        string description;
        string link;
    }

    event ProposalDetails(
        uint256 proposalId,
        address proposer,
        string title,
        string description,
        string link,
        uint256 startBlock,
        uint256 endBlock
    );

    uint256 precision;
    IERC20 token;
    mapping(uint256 => ProposalInfo) proposalCreators;
    IBaseHTS internal tokenService;
    IGODHolder godHolder;

    mapping(uint256 => address[]) proposalVoters;

    function initialize(
        IERC20 _token,
        uint256 _votingDelayValue,
        uint256 _votingPeriodValue,
        IBaseHTS _tokenService,
        IGODHolder _godHolder
    ) public initializer {
        tokenService = _tokenService;
        godHolder = _godHolder;
        token = _token;
        precision = 100000000;
        __Governor_init("HederaTokenCreateGovernor");
        __GovernorSettings_init(
            _votingDelayValue /* 1 block */,
            _votingPeriodValue /* 1 week */,
            0
        );
        __GovernorCountingSimple_init();
    }

    function _getVotes(
        address account,
        uint256,
        bytes memory /*params*/
    ) internal view virtual override returns (uint256) {
        uint256 balance = godHolder.balanceOfVoter(account);
        if (balance == 0) {
            balance = token.balanceOf(account);
        }
        uint256 share = (balance * precision) /
            token.totalSupply();
        uint256 percentageShare = share / (precision / 100);
        return percentageShare;
    }

    function _createProposal(
        string memory title,
        string memory description,
        string memory link
    ) internal returns (uint256) {
        getGODToken();
        (
            address[] memory targets,
            uint256[] memory values,
            bytes[] memory calldatas
        ) = mockFunctionCall();
        uint256 proposalId = super.propose(targets, values, calldatas, title);
        proposalCreators[proposalId] = ProposalInfo(
            _msgSender(),
            title,
            description,
            link
        );
        emit ProposalDetails(
            proposalId,
            _msgSender(),
            title,
            description,
            link,
            proposalSnapshot(proposalId),
            proposalDeadline(proposalId)
        );
        return proposalId;
    }

    function getProposalDetails(
        uint proposalId
    )
        public
        view
        returns (address, string memory, string memory, string memory)
    {
        ProposalInfo memory proposalInfo = proposalCreators[proposalId];
        require(proposalInfo.creator != address(0), "Proposal not found");
        return (
            proposalInfo.creator,
            proposalInfo.title,
            proposalInfo.description,
            proposalInfo.link
        );
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
        string memory title
    ) public returns (uint256 proposalId) {
        (
            address[] memory targets,
            uint256[] memory values,
            bytes[] memory calldatas
        ) = mockFunctionCall();
        bytes32 descriptionHash = keccak256(bytes(title));
        proposalId = hashProposal(targets, values, calldatas, descriptionHash);
        address creator = proposalCreators[proposalId].creator;
        require(creator != address(0), "Proposal not found");
        require(msg.sender == creator, "Only proposer can cancel the proposal");
        proposalId = super._cancel(targets, values, calldatas, descriptionHash);
        returnGODToken(creator);
        address[] memory voters = proposalVoters[proposalId];
        godHolder.removeActiveProposals(voters, proposalId);
        cleanup(proposalId);
    }

    /**
     * @dev See {IGovernor-execute}.
     */
    function executeProposal(
        string memory title
    ) public payable virtual returns (uint256) {
        (
            address[] memory targets,
            uint256[] memory values,
            bytes[] memory calldatas
        ) = mockFunctionCall();
        bytes32 descriptionHash = keccak256(bytes(title));
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
     * @dev See {IGovernor-castVote}.
     */
    function castVote(
        uint256 proposalId,
        uint8 support
    ) public virtual override returns (uint256) {
        address voter = _msgSender();
        require(_getVotes(voter, 0, "") > 0, "No voting power");

        uint256 weight = _castVote(proposalId, voter, support, "");
        godHolder.grabTokensFromUser(voter);
        godHolder.addProposalForVoter(voter, proposalId);
        address[] storage voters = proposalVoters[proposalId];
        voters.push(voter);
        return weight;
    }

    /**
     * @dev Internal execution mechanism. Can be overridden to implement different execution mechanism
     */
    function _execute(
        uint256 proposalId,
        address[] memory,
        uint256[] memory,
        bytes[] memory,
        bytes32 /*descriptionHash*/
    ) internal virtual override {
        address creator = proposalCreators[proposalId].creator;
        returnGODToken(creator);
        address[] memory voters = proposalVoters[proposalId];
        godHolder.removeActiveProposals(voters, proposalId);
        cleanup(proposalId);
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
            revert(
                "GovernorCountingSimpleInternal: token transfer failed to contract."
            );
        }
    }

    function returnGODToken(address creator) internal {
        bool tranferStatus = token.transfer(creator, precision);
        require(
            tranferStatus,
            "GovernorCountingSimpleInternal: returnGODToken failed from contract."
        );
    }

    function cleanup(uint256 proposal) private {
        delete (proposalVoters[proposal]);
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

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[49] private __gap;
}

library Bits {
    uint256 internal constant ONE = uint256(1);

    // Sets the bit at the given 'index' in 'self' to '1'.
    // Returns the modified value.
    function setBit(uint256 self, uint8 index) internal pure returns (uint256) {
        return self | (ONE << index);
    }
}
