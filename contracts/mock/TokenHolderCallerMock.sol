//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;
import "../governance/ITokenHolder.sol";

contract TokenHolderCallerMock {
    ITokenHolder tokenHolder;

    constructor(ITokenHolder _tokenHolder) {
        tokenHolder = _tokenHolder;
    }

    function addProposal(uint256 proposalId) public {
        tokenHolder.addProposalForVoter(proposalId);
    }

    function removeProposals(
        uint256 proposalId,
        address[] memory voters
    ) public {
        tokenHolder.removeActiveProposals(voters, proposalId);
    }
}
