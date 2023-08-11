//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;
import "../governance/ITokenHolder.sol";
import "../common/TokenOperations.sol";

contract GovernorMock is TokenOperations {
    event ProposalCreated(uint256 pId);
    struct PInfo {
        bool isCancelled;
        bool isExecuted;
        mapping(address => bool) votes;
        address[] voters;
        address creator;
    }

    uint256 private constant PROPOSAL_CREATION_AMOUNT = 1e8;
    uint256 private constant NFT_SERIAL_ID = 1;

    uint256 proposalId;
    mapping(uint256 => PInfo) proposals;

    address token;
    ITokenHolder tokenHolder;

    constructor(address _token, ITokenHolder _tokenHolder) {
        token = _token;
        tokenHolder = _tokenHolder;
    }

    function createProposal() public {
        proposalId++;
        PInfo storage pInfo = proposals[proposalId];
        pInfo.creator = msg.sender;
        _getGODToken(msg.sender, NFT_SERIAL_ID);
        emit ProposalCreated(proposalId);
    }

    function castVote(uint256 pID) public {
        require(!proposals[pID].isCancelled, "Already Cancelled");
        require(!proposals[pID].isExecuted, "Already executed");
        require(!proposals[pID].votes[msg.sender], "Already voted");
        proposals[pID].votes[msg.sender] = true;
        proposals[pID].voters.push(msg.sender);
        tokenHolder.addProposalForVoter(pID);
    }

    function execute(uint256 pID) public {
        require(!proposals[pID].isCancelled, "Already Cancelled");
        require(!proposals[pID].isExecuted, "Already executed");
        proposals[pID].isExecuted = true;
        tokenHolder.removeActiveProposals(proposals[pID].voters, pID);
        _returnGODToken(proposals[pID].creator, NFT_SERIAL_ID);
    }

    function cancel(uint256 pID) public {
        require(!proposals[pID].isCancelled, "Already Cancelled");
        require(!proposals[pID].isExecuted, "Already executed");
        cancelProposal(pID, proposals[pID].voters);
    }

    function cancelProposal(uint256 pID, address[] memory voters) public {
        proposals[pID].isCancelled = true;
        tokenHolder.removeActiveProposals(voters, pID);
        _returnGODToken(proposals[pID].creator, NFT_SERIAL_ID);
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
}
