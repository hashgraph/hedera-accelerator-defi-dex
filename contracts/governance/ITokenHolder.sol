// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;
import "../common/IERC20.sol";
import "../common/IBaseHTS.sol";

interface ITokenHolder {
    function initialize(IBaseHTS tokenService, address token) external;

    function revertTokensForVoter(uint256 idOrAmount) external returns (int32);

    function balanceOfVoter(address voter) external view returns (uint256);

    function grabTokensFromUser(address user, uint256 idOrAmount) external;

    function addProposalForVoter(
        address voter,
        uint256 proposalId
    ) external returns (int32);

    function removeActiveProposals(
        address[] memory voters,
        uint256 proposalId
    ) external returns (int32);

    function getToken() external view returns (address);

    function isNFTType() external view returns (bool);
}
