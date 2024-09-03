// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "./ITokenHolder.sol";

import "../holder/IAssetsHolder.sol";

import "../common/IErrors.sol";
import "../common/ISharedModel.sol";
import "../common/TokenOperations.sol";
import "../common/ISystemRoleBasedAccess.sol";
import "../common/hedera/HederaResponseCodes.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorSettingsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorCountingSimpleUpgradeable.sol";

/**
 * @title Hedera Governor
 *
 * A governance contract for managing proposals and voting with GOD tokens.
 * The contract integrates with Hedera services and supports ERC20/ERC721 tokens for voting.
 */
contract HederaGovernor is
    IErrors,
    ISharedModel,
    TokenOperations,
    OwnableUpgradeable,
    GovernorSettingsUpgradeable,
    GovernorCountingSimpleUpgradeable
{
    // inputs from UI while creating the proposals
    struct CreationInputs {
        uint256 proposalType;
        string title;
        string description;
        string discussionLink;
        string metadata;
        uint256 amountOrId;
        address[] targets;
        uint256[] _values;
        bytes[] calldatas;
    }

    // Core information about a proposal
    struct CoreInformation {
        address creator;
        uint256 createdAt;
        uint256 voteStart;
        uint256 voteEnd;
        uint256 blockedAmountOrId;
        CreationInputs inputs;
    }

    /**
     * @notice ProposalCoreInformation event.
     * @dev Emitted when core information about a proposal is created or updated.
     *
     * @param proposalId The proposal ID.
     * @param coreInformation The core information associated with the proposal.
     */
    event ProposalCoreInformation(
        uint256 indexed proposalId,
        CoreInformation coreInformation
    );

    /**
     * @notice QuorumThresholdSet event.
     * @dev Emitted when the quorum threshold is updated.
     *
     * @param oldQuorum The previous quorum threshold.
     * @param newQuorum The new quorum threshold.
     */
    event QuorumThresholdSet(uint256 oldQuorum, uint256 newQuorum);

    // Voting information related to a proposal.
    struct VotingInformation {
        uint256 quorumValue;
        uint256 againstVotes;
        uint256 forVotes;
        uint256 abstainVotes;
        bool isQuorumReached;
        bool isVoteSucceeded;
        bool hasVoted;
        ProposalState proposalState;
    }

    /**
     * @notice ProposalVotingInformation event.
     * @dev Emitted when voting information is created or updated for a proposal.
     *
     * @param proposalId The proposal ID.
     * @param votingInformation The updated voting information for the proposal.
     */
    event ProposalVotingInformation(
        uint256 indexed proposalId,
        VotingInformation votingInformation
    );

    // Determines whether the token is an NFT.
    bool private isNFTToken;
    // The address of the associated token.
    address private tokenAddress;
    // The contract managing the token holders.
    ITokenHolder private tokenHolder;

    // The contract managing asset holding.
    IAssetsHolder private iAssetsHolder;
    // The contract managing role-based access.
    ISystemRoleBasedAccess private iSystemRoleBasedAccess;

    // The quorum threshold, in basis points (bps).
    uint256 private quorumThresholdInBsp;

    // Proposal ID => Core Information struct.
    mapping(uint256 => CoreInformation) private proposalsInfo;

    // Reserved storage space to allow future upgrades.
    uint256[49] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract with the required parameters.
     *
     * @param _config The Governor configuration.
     * @param _iTokenHolder The address of the Token holder contract.
     * @param _iAssetsHolder The address of Asset holder contract.
     * @param _iHederaService The address of the Hedera service.
     * @param _iSystemRoleBasedAccess The address of the roles manager contract.
     */
    function initialize(
        GovernorConfig memory _config,
        ITokenHolder _iTokenHolder,
        IAssetsHolder _iAssetsHolder,
        IHederaService _iHederaService,
        ISystemRoleBasedAccess _iSystemRoleBasedAccess
    ) public initializer {
        __Ownable_init();
        __Governor_init("HederaGovernor");
        __GovernorSettings_init(_config.votingDelay, _config.votingPeriod, 0);
        __GovernorCountingSimple_init();
        _setQuorumThreshold(_config.quorumThresholdInBsp);

        iSystemRoleBasedAccess = _iSystemRoleBasedAccess;

        tokenHolder = _iTokenHolder;
        tokenAddress = _iTokenHolder.getToken();
        isNFTToken = _isNFTToken(_iHederaService, tokenAddress);

        iAssetsHolder = _iAssetsHolder;
        iAssetsHolder.initialize(tokenAddress, _iHederaService);

        _associateGodToken();
    }

    /**
     * @dev Returns the GOD token address.
     */
    function getGODTokenAddress() public view returns (address) {
        return tokenAddress;
    }

    /**
     * @dev Returns the address of the current Hedera service.
     */
    function getHederaServiceVersion() public view returns (IHederaService) {
        return iAssetsHolder.getHederaServiceVersion();
    }

    /**
     * @dev Returns the address of the Token holder contract.
     */
    function getTokenHolderContractAddress()
        public
        view
        returns (ITokenHolder)
    {
        return tokenHolder;
    }

    /**
     * @dev Returns the address of the Asset holder contract.
     */
    function getAssetHolderContractAddress()
        public
        view
        returns (IAssetsHolder)
    {
        return iAssetsHolder;
    }

    /**
     * @dev Returns the voting information for a given proposal ID.
     *
     * @param proposalId The proposal ID.
     * @return votingInfo The voting information associated with the proposal.
     */
    function getVotingInformation(
        uint256 proposalId
    ) public view returns (VotingInformation memory votingInfo) {
        (
            uint256 againstVotes,
            uint256 forVotes,
            uint256 abstainVotes
        ) = proposalVotes(proposalId);

        votingInfo.abstainVotes = abstainVotes;
        votingInfo.forVotes = forVotes;
        votingInfo.againstVotes = againstVotes;
        votingInfo.quorumValue = quorum(0);
        votingInfo.isQuorumReached = _quorumReached(proposalId);
        votingInfo.isVoteSucceeded = _voteSucceeded(proposalId);
        votingInfo.hasVoted = hasVoted(proposalId, msg.sender);
        votingInfo.proposalState = state(proposalId);
    }

    /**
     * @dev Returns the proposal threshold value.
     *
     * @return The proposal threshold value.
     */
    function proposalThreshold()
        public
        view
        override(GovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    /**
     * @dev Returns the quorum value based on the proposal ID.
     *
     * @return The quorum value for the proposal.
     */
    function quorum(uint256) public view virtual override returns (uint256) {
        uint256 totalSupply = isNFTToken
            ? IERC721(tokenAddress).totalSupply()
            : IERC20(tokenAddress).totalSupply();
        uint256 value = totalSupply * quorumThresholdInBsp;
        require(value >= 10_000, "GCSI: (GOD token * quorum) < 10,000");
        return value / 10_000;
    }

    /**
     * @dev Returns the current block timestamp.
     *
     * @return The current block timestamp.
     */
    function clock() public view virtual override returns (uint48) {
        return SafeCastUpgradeable.toUint48(block.timestamp);
    }

    /**
     * @notice Returns the clock mode.
     * @return The clock mode as a string.
     */
    function CLOCK_MODE() public view virtual override returns (string memory) {
        return "mode=timestamp";
    }

    /**
     * @dev Returns the quorum threshold.
     */
    function quorumThreshold() public view returns (uint256) {
        return quorumThresholdInBsp;
    }

    /**
     * @dev Sets a new quorum threshold.
     * Can be called only by Governance.
     *
     * @param _newQuorumThresholdInBsp The new quorum threshold in basis points.
     */
    function setQuorumThreshold(
        uint256 _newQuorumThresholdInBsp
    ) public onlyGovernance {
        _setQuorumThreshold(_newQuorumThresholdInBsp);
    }

    /**
     * @dev Upgrades the current Hedera service.
     *
     * @param _newIHederaService The new Hedera service.
     */
    function upgradeHederaService(
        IHederaService _newIHederaService
    ) external onlyOwner {
        iAssetsHolder.upgradeHederaService(_newIHederaService);
    }

    /**
     * @dev Disables the default propose function, making it unavailable.
     * This function is overridden to always revert with a custom error.
     *
     * @return This function does not return a proposalId as it always reverts.
     */
    function propose(
        address[] memory,
        uint256[] memory,
        bytes[] memory,
        string memory
    ) public pure override returns (uint256) {
        revert InvalidInput("GCSI: propose api disabled");
    }

    /**
     * @dev Creates a new proposal with the provided inputs.
     * Validates the proposal's title and blocks the required amount of GOD tokens.
     * Emits a `ProposalCoreInformation` event with the proposal's core information.
     *
     * @param _inputs Struct containing the necessary inputs to create a proposal.
     * @return proposalId The ID of the newly created proposal.
     */
    function createProposal(
        CreationInputs memory _inputs
    ) public returns (uint256 proposalId) {
        if (bytes(_inputs.title).length == 0) {
            revert InvalidInput("GCSI: title blank");
        }
        uint256 blockedAmountOrId = _blockGodToken(
            _msgSender(),
            _inputs.amountOrId
        );
        proposalId = super.propose(
            _inputs.targets,
            _inputs._values,
            _inputs.calldatas,
            _inputs.title
        );

        CoreInformation memory info;
        info.creator = _msgSender();
        info.createdAt = clock();
        info.voteStart = proposalSnapshot(proposalId);
        info.voteEnd = proposalDeadline(proposalId);
        info.blockedAmountOrId = blockedAmountOrId;
        info.inputs = _inputs;
        proposalsInfo[proposalId] = info;
        emit ProposalCoreInformation(proposalId, info);
        _emitVotingInformation(proposalId);
    }

    /**
     * @dev Cancels an active proposal.
     * Overrides the default cancel function to allow only the proposer to cancel.
     * Emits an updated voting information event and cleans up the proposal's resources.
     *
     * @param targets Array of target addresses associated with the proposal.
     * @param values Array of values associated with the proposal.
     * @param calldatas Array of calldata associated with the proposal.
     * @param descriptionHash Hash of the proposal's description.
     * @return proposalId The ID of the cancelled proposal.
     */
    function cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public override returns (uint256 proposalId) {
        // Note :-> not using super.cancel() because only pending proposals are allwowed to cancel in super
        // so we using super._cancel internal method
        proposalId = super._cancel(targets, values, calldatas, descriptionHash);
        require(
            _msgSender() == proposalProposer(proposalId),
            "GCSI: Only proposer can cancel"
        );
        _emitVotingInformation(proposalId);
        _cleanup(proposalId);
    }

    /**
     * @dev Executes an approved proposal.
     * Overrides the default execute function to emit voting information and clean up resources.
     *
     * @param proposalId The ID of the proposal to execute.
     * @param targets Array of target addresses associated with the proposal.
     * @param values Array of values associated with the proposal.
     * @param calldatas Array of calldata associated with the proposal.
     * @param descriptionHash Hash of the proposal's description.
     */
    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
        _emitVotingInformation(proposalId);
        _cleanup(proposalId);
    }

    /**
     * @dev Returns the number of votes an account has based on its GOD token balance.
     * The actual number of votes is fetched from the TokenHolder contract.
     *
     * @param account The address of the account to get votes for.
     * @return The number of votes the account has.
     */
    function _getVotes(
        address account,
        uint256 /* timepoint */,
        bytes memory /* params */
    ) internal view override returns (uint256) {
        return tokenHolder.balanceOfVoter(account);
    }

    /**
     * @dev Casts a vote on a proposal.
     * Only accounts with locked tokens can vote. Emits updated voting information after casting the vote.
     *
     * @param proposalId The ID of the proposal to vote on.
     * @param account The address of the account casting the vote.
     * @param support The vote choice (against, for, or abstain).
     * @param reason The reason for the vote.
     * @param params Additional voting parameters.
     * @return weight The weight of the vote cast by the account.
     */
    function _castVote(
        uint256 proposalId,
        address account,
        uint8 support,
        string memory reason,
        bytes memory params
    ) internal override returns (uint256 weight) {
        weight = super._castVote(proposalId, account, support, reason, params);
        require(weight > 0, "GCSI: lock token to vote");
        tokenHolder.addProposalForVoter(proposalId);
        _emitVotingInformation(proposalId);
    }

    /**
     * @dev Emits an event containing the voting information of a proposal.
     *
     * @param proposalId The ID of the proposal.
     */
    function _emitVotingInformation(uint256 proposalId) private {
        emit ProposalVotingInformation(
            proposalId,
            getVotingInformation(proposalId)
        );
    }

    /**
     * @dev Cleans up resources after a proposal has been executed or cancelled.
     *
     * @param _proposalId The ID of the proposal to clean up.
     */
    function _cleanup(uint256 _proposalId) private {
        CoreInformation memory proposalInfo = proposalsInfo[_proposalId];
        tokenHolder.removeActiveProposals(_proposalId);
        _unblockGodToken(proposalInfo.creator, proposalInfo.blockedAmountOrId);
    }

    /**
     * @dev Blocks a specified amount of GOD tokens during the creation of a proposal.
     * Transfers tokens from the creator to the contract address.
     *
     * @param _creator The address of the proposal creator.
     * @param _amountOrId The amount of tokens or ID of the NFT to block.
     * @return The amount or ID of the tokens blocked.
     */
    function _blockGodToken(
        address _creator,
        uint256 _amountOrId
    ) private returns (uint256) {
        _amountOrId = isNFTToken ? _amountOrId : 1e8;
        int256 code = _transferAssests(
            isNFTToken,
            tokenAddress,
            _creator,
            address(this),
            _amountOrId
        );
        require(
            code == HederaResponseCodes.SUCCESS,
            "GCSI: transfer failed to contract"
        );
        return _amountOrId;
    }

    /**
     * @dev Unblocks the GOD tokens after a proposal is cancelled or executed.
     * Transfers tokens back to the creator from the contract address.
     *
     * @param _creator The address of the proposal creator.
     * @param _blockedAmountOrId The amount of tokens or ID of the NFT to unblock.
     */
    function _unblockGodToken(
        address _creator,
        uint256 _blockedAmountOrId
    ) private {
        int256 code = _transferAssests(
            isNFTToken,
            tokenAddress,
            address(this),
            _creator,
            _blockedAmountOrId
        );
        require(
            code == HederaResponseCodes.SUCCESS,
            "GCSI: transfer failed from contract."
        );
    }

    /**
     * @dev Associates the GOD token with the contract.
     */
    function _associateGodToken() private {
        int256 code = _associateToken(
            getHederaServiceVersion(),
            address(this),
            tokenAddress
        );
        require(
            code == HederaResponseCodes.TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT ||
                code == HederaResponseCodes.SUCCESS,
            "GCSI: association failed"
        );
    }

    /**
     * @dev Sets a new quorum threshold.
     *
     * @param _newQuorumThresholdInBsp The new quorum threshold in basis points.
     */
    function _setQuorumThreshold(uint256 _newQuorumThresholdInBsp) private {
        uint256 newQuorumThresholdInBsp = _newQuorumThresholdInBsp == 0
            ? 500
            : _newQuorumThresholdInBsp;
        emit QuorumThresholdSet(quorumThresholdInBsp, newQuorumThresholdInBsp);
        quorumThresholdInBsp = newQuorumThresholdInBsp;
    }
}
