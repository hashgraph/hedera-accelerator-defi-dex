//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "../common/IERC20.sol";

import "../governance/IGODTokenHolderFactory.sol";

contract GODHolderMock is IGODHolder {
    function initialize(
        IBaseHTS tokenService,
        IERC20 token
    ) external override {}

    function revertTokensForVoter() external override returns (int32) {}

    function balanceOfVoter(
        address voter
    ) external view override returns (uint256) {}

    function grabTokensFromUser(
        address user
    ) external override returns (uint256 amount) {}

    function addProposalForVoter(
        address voter,
        uint256 proposalId
    ) external override returns (int32) {}

    function removeActiveProposals(
        address[] memory voters,
        uint256 proposalId
    ) external override returns (int32) {}

    function getGODToken() external view override returns (IERC20) {}
}
