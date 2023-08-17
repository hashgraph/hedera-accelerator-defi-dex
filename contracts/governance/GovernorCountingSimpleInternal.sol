// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/governance/GovernorUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/IGovernorUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorSettingsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorCountingSimpleUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../common/IERC20.sol";
import "../common/IHederaService.sol";
import "../common/hedera/HederaResponseCodes.sol";
import "./TokenHolder.sol";
import "./IGovernorBase.sol";
import "../common/IErrors.sol";
import "../common/TokenOperations.sol";

abstract contract GovernorCountingSimpleInternal is
    Initializable,
    IGovernorBase,
    GovernorUpgradeable,
    GovernorSettingsUpgradeable,
    GovernorCountingSimpleUpgradeable,
    TokenOperations,
    OwnableUpgradeable,
    IErrors
{
    struct ProposalInfo {
        address creator;
        string title;
        string description;
        string link;
        bytes data;
        address[] voters;
        uint256 nftTokenSerialId;
    }

    struct VotingInformation {
        uint256 quorumValue;
        bool isQuorumReached;
        ProposalState proposalState;
        bool voted;
        address votedUser;
        uint256 againstVotes;
        uint256 forVotes;
        uint256 abstainVotes;
    }

    struct Duration {
        uint256 startBlock;
        uint256 endBlock;
    }

    event ProposalDetails(
        uint256 proposalId,
        address proposer,
        string title,
        string description,
        string link,
        bytes data,
        Duration duration,
        VotingInformation votingInformation,
        uint256 nftTokenSerialId
    );

    uint256 private constant PROPOSAL_CREATION_AMOUNT = 1e8;
    address[] private EMPTY_VOTERS_LIST;

    address private token;
    IHederaService internal hederaService;
    ITokenHolder tokenHolder;

    uint256 quorumThresholdInBsp;

    mapping(uint256 => ProposalInfo) proposals;

    ISystemRoleBasedAccess internal iSystemRoleBasedAccess;

    function initialize(
        address _token,
        uint256 _votingDelayValue,
        uint256 _votingPeriodValue,
        IHederaService _hederaService,
        ITokenHolder _tokenHolder,
        uint256 _quorumThresholdInBsp,
        ISystemRoleBasedAccess _iSystemRoleBasedAccess
    ) public initializer {
        __Ownable_init();
        hederaService = _hederaService;
        tokenHolder = _tokenHolder;
        token = _token;
        quorumThresholdInBsp = _quorumThresholdInBsp == 0
            ? 500
            : _quorumThresholdInBsp;
        iSystemRoleBasedAccess = _iSystemRoleBasedAccess;
        __Governor_init("HederaTokenCreateGovernor");
        __GovernorSettings_init(
            _votingDelayValue /* 1 block */,
            _votingPeriodValue /* 1 week */,
            0
        );
        __GovernorCountingSimple_init();
        _associateTokenInternally(address(token));
    }

    function getGODTokenAddress() external view returns (address) {
        return address(token);
    }

    function _getVotes(
        address account,
        uint256,
        bytes memory /*params*/
    ) internal view virtual override returns (uint256) {
        return tokenHolder.balanceOfVoter(account);
    }

    function _createProposal(
        string memory title,
        string memory description,
        string memory link,
        address creator,
        bytes memory data,
        uint256 nftTokenSerialId
    ) internal returns (uint256) {
        if (bytes(title).length == 0) {
            revert InvalidInput(
                "GovernorCountingSimpleInternal: proposal title can not be blank"
            );
        }
        (
            address[] memory targets,
            uint256[] memory values,
            bytes[] memory calldatas
        ) = _mockFunctionCall();
        uint256 proposalId = super.propose(targets, values, calldatas, title);
        proposals[proposalId] = ProposalInfo(
            creator,
            title,
            description,
            link,
            data,
            EMPTY_VOTERS_LIST,
            nftTokenSerialId
        );

        _getGODToken(creator, nftTokenSerialId);

        Duration memory duration;
        duration.startBlock = proposalSnapshot(proposalId);
        duration.endBlock = proposalDeadline(proposalId);

        emit ProposalDetails(
            proposalId,
            creator,
            title,
            description,
            link,
            data,
            duration,
            getVotingInformation(proposalId),
            nftTokenSerialId
        );

        return proposalId;
    }

    function getVotingInformation(
        uint256 proposalId
    ) private view returns (VotingInformation memory) {
        (
            uint256 againstVotes,
            uint256 forVotes,
            uint256 abstainVotes
        ) = proposalVotes(proposalId);

        VotingInformation memory votingInfo;
        votingInfo.quorumValue = quorum(0);
        votingInfo.isQuorumReached = _quorumReached(proposalId);
        votingInfo.proposalState = state(proposalId);
        votingInfo.voted = hasVoted(proposalId, msg.sender);
        votingInfo.votedUser = msg.sender;
        votingInfo.abstainVotes = abstainVotes;
        votingInfo.forVotes = forVotes;
        votingInfo.againstVotes = againstVotes;

        return votingInfo;
    }

    function getProposalDetails(
        uint256 proposalId
    )
        public
        returns (
            uint256 quorumValue,
            bool isQuorumReached,
            ProposalState proposalState,
            bool voted,
            uint256 againstVotes,
            uint256 forVotes,
            uint256 abstainVotes,
            address creator,
            string memory title,
            string memory descripition,
            string memory link
        )
    {
        ProposalInfo memory proposalInfo = _getProposalInfoIfExist(proposalId);
        VotingInformation memory votingInfo = getVotingInformation(proposalId);

        quorumValue = votingInfo.quorumValue;
        isQuorumReached = votingInfo.isQuorumReached;
        proposalState = votingInfo.proposalState;
        voted = votingInfo.voted;
        againstVotes = votingInfo.againstVotes;
        forVotes = votingInfo.forVotes;
        abstainVotes = votingInfo.abstainVotes;
        creator = proposalInfo.creator;
        title = proposalInfo.title;
        descripition = proposalInfo.description;
        link = proposalInfo.link;

        Duration memory duration;
        duration.startBlock = proposalSnapshot(proposalId);
        duration.endBlock = proposalDeadline(proposalId);

        emit ProposalDetails(
            proposalId,
            creator,
            title,
            descripition,
            link,
            proposalInfo.data,
            duration,
            votingInfo,
            proposalInfo.nftTokenSerialId
        );
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
        ) = _mockFunctionCall();
        bytes32 descriptionHash = keccak256(bytes(title));
        proposalId = hashProposal(targets, values, calldatas, descriptionHash);
        ProposalInfo memory proposalInfo = _getProposalInfoIfExist(proposalId);
        require(
            msg.sender == proposalInfo.creator,
            "GovernorCountingSimpleInternal: Only proposer can cancel the proposal"
        );
        proposalId = super._cancel(targets, values, calldatas, descriptionHash);
        _cleanup(proposalId);
        getProposalDetails(proposalId);
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
        ) = _mockFunctionCall();
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
    function castVotePublic(
        uint256 proposalId,
        uint256 /* tokenId */,
        uint8 support
    ) public returns (uint256) {
        address voter = _msgSender();
        ProposalInfo storage proposalInfo = _getProposalInfoIfExist(proposalId);
        require(
            _getVotes(voter, 0, "") > 0,
            "GovernorCountingSimpleInternal: token locking is required to cast the vote"
        );
        tokenHolder.addProposalForVoter(proposalId);
        uint256 weight = _castVote(proposalId, voter, support, "");
        proposalInfo.voters.push(voter);
        getProposalDetails(proposalId);
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
        _cleanup(proposalId);
        getProposalDetails(proposalId);
    }

    function quorum(
        uint256
    ) public view override(IGovernorUpgradeable) returns (uint256) {
        if (!tokenHolder.isNFTType()) {
            uint256 totalSupply = IERC20(token).totalSupply();
            uint256 value = totalSupply * quorumThresholdInBsp;
            require(
                value >= 10_000,
                "GovernorCountingSimpleInternal: GOD token total supply multiple by quorum threshold in BSP cannot be less than 10,000"
            );
            return value / 10_000;
        } else {
            return 1;
        }
    }

    function upgradeHederaService(
        IHederaService newHederaService
    ) external virtual onlyOwner {
        hederaService = newHederaService;
    }

    function getHederaServiceVersion()
        external
        view
        virtual
        returns (IHederaService)
    {
        return hederaService;
    }

    function _associateTokenInternally(address _token) internal {
        int256 code = _associateToken(hederaService, address(this), _token);
        if (
            code != HederaResponseCodes.SUCCESS &&
            code != HederaResponseCodes.TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT
        ) {
            revert("GCSI: association failed");
        }
    }

    function _mockFunctionCall()
        private
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

    function _getGODToken(address creator, uint256 nftTokenSerialId) private {
        if (!tokenHolder.isNFTType()) {
            int256 code = _transferToken(
                address(token),
                creator,
                address(this),
                PROPOSAL_CREATION_AMOUNT
            );
            require(
                code == HederaResponseCodes.SUCCESS,
                "GovernorCountingSimpleInternal: token transfer failed to contract."
            );
        } else {
            _transferNFTToken(
                address(token),
                creator,
                address(this),
                nftTokenSerialId
            );
        }
    }

    function _returnGODToken(
        address creator,
        uint256 nftTokenSerialId
    ) private {
        if (!tokenHolder.isNFTType()) {
            int256 code = _transferToken(
                address(token),
                address(this),
                creator,
                PROPOSAL_CREATION_AMOUNT
            );
            require(
                code == HederaResponseCodes.SUCCESS,
                "GovernorCountingSimpleInternal: token transfer failed from contract."
            );
        } else {
            _transferNFTToken(
                address(token),
                address(this),
                creator,
                nftTokenSerialId
            );
        }
    }

    function _cleanup(uint256 proposalId) private {
        ProposalInfo storage proposalInfo = _getProposalInfoIfExist(proposalId);
        tokenHolder.removeActiveProposals(proposalInfo.voters, proposalId);
        _returnGODToken(proposalInfo.creator, proposalInfo.nftTokenSerialId);
        delete (proposalInfo.voters);
    }

    function _getProposalInfoIfExist(
        uint256 proposalId
    ) private view returns (ProposalInfo storage info) {
        info = proposals[proposalId];
        require(
            info.creator != address(0),
            "GovernorCountingSimpleInternal: Proposal not found"
        );
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[49] private __gap;
}
