//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;
import "../governance/ITokenHolder.sol";

contract GovernorMock {
    event ProposalCreated(uint256 pId);
    struct PInfo {
        bool isCancelled;
        bool isExecuted;
        mapping(address => bool) votes;
        address[] voters;
    }

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
        proposals[proposalId];
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
    }

    function cancel(uint256 pID) public {
        require(!proposals[pID].isCancelled, "Already Cancelled");
        require(!proposals[pID].isExecuted, "Already executed");
        proposals[pID].isCancelled = true;
        tokenHolder.removeActiveProposals(proposals[pID].voters, pID);
    }

    function cancelProposal(uint256 pID, address[] memory voters) public {
        proposals[pID].isCancelled = true;
        tokenHolder.removeActiveProposals(voters, pID);
    }
}
