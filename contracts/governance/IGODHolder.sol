// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;
import "../common/IERC20.sol";
import "../common/IBaseHTS.sol";

interface IGODHolder {
    function initialize(IBaseHTS tokenService, IERC20 token) external;

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

    function getGODToken() external view returns (IERC20);
}
