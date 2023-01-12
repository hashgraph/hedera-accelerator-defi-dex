// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

interface IGODHolder {
    function revertTokensForVoter() external returns (int32);

    function balanceOfVoter(address voter) external view returns (uint256);

    function grabTokensFromUser(address user) external returns (uint256 amount);

    function addProposalForVoter(
        address voter,
        uint256 proposalId
    ) external returns (int32);

    function removeActiveProposals(
        address[] memory voters,
        uint256 proposalId
    ) external returns (int32);
}
