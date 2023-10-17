// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "./ITokenHolder.sol";

import "../holder/IAssetsHolder.sol";

import "../common/IErrors.sol";
import "../common/ISharedModel.sol";
import "../common/TokenOperations.sol";
import "../common/FeeConfiguration.sol";
import "../common/ISystemRoleBasedAccess.sol";
import "../common/hedera/HederaResponseCodes.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorSettingsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorCountingSimpleUpgradeable.sol";

contract HederaGovernor is
    IErrors,
    ISharedModel,
    TokenOperations,
    FeeConfiguration,
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

    struct CoreInformation {
        address creator;
        uint256 createdAt;
        uint256 voteStart;
        uint256 voteEnd;
        uint256 blockedAmountOrId;
        CreationInputs inputs;
    }

    event ProposalCoreInformation(
        uint256 indexed proposalId,
        CoreInformation coreInformation
    );

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

    event ProposalVotingInformation(
        uint256 indexed proposalId,
        VotingInformation votingInformation
    );

    // token related info
    bool private isNFTToken;
    address private tokenAddress;
    ITokenHolder private tokenHolder;

    IAssetsHolder private iAssetsHolder;

    uint256 private quorumThresholdInBsp;
    mapping(uint256 => CoreInformation) private proposalsInfo;

    // must be last in order
    uint256[49] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        GovernorConfig memory _config,
        FeeConfig memory _feeConfig,
        ITokenHolder _iTokenHolder,
        IAssetsHolder _iAssetsHolder,
        IHederaService _iHederaService,
        ISystemRoleBasedAccess _iSystemRoleBasedAccess
    ) public initializer {
        __Ownable_init();
        __Governor_init("HederaGovernor");
        __GovernorSettings_init(_config.votingDelay, _config.votingPeriod, 0);
        __GovernorCountingSimple_init();
        __FeeConfiguration_init(_feeConfig, _iSystemRoleBasedAccess);

        quorumThresholdInBsp = _config.quorumThresholdInBsp == 0
            ? 500
            : _config.quorumThresholdInBsp;

        tokenHolder = _iTokenHolder;
        tokenAddress = _iTokenHolder.getToken();
        isNFTToken = _isNFTToken(_iHederaService, tokenAddress);

        iAssetsHolder = _iAssetsHolder;
        iAssetsHolder.initialize(tokenAddress, _iHederaService);

        _associateGodToken();
    }

    function getGODTokenAddress() public view returns (address) {
        return tokenAddress;
    }

    function getHederaServiceVersion() public view returns (IHederaService) {
        return iAssetsHolder.getHederaServiceVersion();
    }

    function getTokenHolderContractAddress()
        public
        view
        returns (ITokenHolder)
    {
        return tokenHolder;
    }

    function getAssetHolderContractAddress()
        public
        view
        returns (IAssetsHolder)
    {
        return iAssetsHolder;
    }

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

    function proposalThreshold()
        public
        view
        override(GovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    function quorum(uint256) public view virtual override returns (uint256) {
        uint256 totalSupply = isNFTToken
            ? IERC721(tokenAddress).totalSupply()
            : IERC20(tokenAddress).totalSupply();
        uint256 value = totalSupply * quorumThresholdInBsp;
        require(value >= 10_000, "GCSI: (GOD token * quorum) < 10,000");
        return value / 10_000;
    }

    function clock() public view virtual override returns (uint48) {
        return SafeCastUpgradeable.toUint48(block.timestamp);
    }

    function CLOCK_MODE() public view virtual override returns (string memory) {
        return "mode=timestamp";
    }

    function upgradeHederaService(
        IHederaService _newIHederaService
    ) external onlyOwner {
        iAssetsHolder.upgradeHederaService(_newIHederaService);
    }

    function propose(
        address[] memory,
        uint256[] memory,
        bytes[] memory,
        string memory
    ) public pure override returns (uint256) {
        revert InvalidInput("GCSI: propose api disabled");
    }

    function createProposal(
        CreationInputs memory _inputs
    ) public payable returns (uint256 proposalId) {
        if (bytes(_inputs.title).length == 0) {
            revert InvalidInput("GCSI: title blank");
        }
        _deductFee(getHederaServiceVersion());
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

    function _getVotes(
        address account,
        uint256 /* timepoint */,
        bytes memory /* params */
    ) internal view override returns (uint256) {
        return tokenHolder.balanceOfVoter(account);
    }

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

    function _feeConfigExecutor()
        internal
        view
        virtual
        override
        returns (address)
    {
        return address(this);
    }

    function _emitVotingInformation(uint256 proposalId) private {
        emit ProposalVotingInformation(
            proposalId,
            getVotingInformation(proposalId)
        );
    }

    function _cleanup(uint256 _proposalId) private {
        CoreInformation memory proposalInfo = proposalsInfo[_proposalId];
        tokenHolder.removeActiveProposals(_proposalId);
        _unblockGodToken(proposalInfo.creator, proposalInfo.blockedAmountOrId);
    }

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
}
