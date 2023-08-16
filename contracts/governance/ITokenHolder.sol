// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;
import "../common/IERC20.sol";
import "../common/IHederaService.sol";

interface ITokenHolder {
    function initialize(IHederaService hederaService, address token) external;

    function revertTokensForVoter(uint256 idOrAmount) external returns (int32);

    function balanceOfVoter(address voter) external view returns (uint256);

    function grabTokensFromUser(uint256 idOrAmount) external;

    function addProposalForVoter(uint256 proposalId) external returns (int32);

    function removeActiveProposals(
        address[] memory voters,
        uint256 proposalId
    ) external returns (int32);

    function getToken() external view returns (address);

    function isNFTType() external view returns (bool);

    function upgradeHederaService(IHederaService newHederaService) external;

    function getHederaServiceVersion() external view returns (IHederaService);
}
