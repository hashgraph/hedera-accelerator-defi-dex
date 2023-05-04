//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;
import "../common/IERC20.sol";

import "../governance/ITokenHolderFactory.sol";

contract GODHolderMock is ITokenHolder {
    function initialize(
        IBaseHTS tokenService,
        address token
    ) external override {}

    function revertTokensForVoter(uint256) external override returns (int32) {}

    function balanceOfVoter(
        address voter
    ) external view override returns (uint256) {}

    function grabTokensFromUser(address user, uint256) external override {}

    function addProposalForVoter(
        address voter,
        uint256 proposalId
    ) external override returns (int32) {}

    function removeActiveProposals(
        address[] memory voters,
        uint256 proposalId
    ) external override returns (int32) {}

    function getToken() external view override returns (address) {}

    function isNFTType() external pure returns (bool) {
        return false;
    }
}
