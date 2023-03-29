//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "../common/IERC20.sol";

import "../governance/IGODTokenHolderFactory.sol";

contract NFTHolderMock is IGODHolder {
    function initialize(
        IBaseHTS tokenService,
        address token
    ) external override {}

    function revertTokensForVoter() external override returns (int32) {}

    function balanceOfVoter(
        address voter
    ) external view override returns (uint256) {}

    function grabTokensFromUser(address user, int256) external override {}

    function addProposalForVoter(
        address voter,
        uint256 proposalId
    ) external override returns (int32) {}

    function removeActiveProposals(
        address[] memory voters,
        uint256 proposalId
    ) external override returns (int32) {}

    function getToken() external view override returns (address) {}
}
