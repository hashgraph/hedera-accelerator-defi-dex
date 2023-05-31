//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./common/IHederaService.sol";

interface ILPToken {
    function initialize(
        IHederaService _hederaService,
        address _owner,
        string memory tokenName,
        string memory tokenSymbol
    ) external payable;

    function allotLPTokenFor(
        uint256 amountA,
        uint256 amountB,
        address _toUser
    ) external returns (int256 responseCode);

    function removeLPTokenFor(
        uint256 lpAmount,
        address fromUser
    ) external returns (int256 responseCode);

    function lpTokenForUser(address _user) external view returns (uint256);

    function getLpTokenAddress() external view returns (address);

    function getAllLPTokenCount() external view returns (uint256);

    function lpTokenCountForGivenTokensQty(
        uint256 tokenAQuantity,
        uint256 tokenBQuantity
    ) external view returns (uint256);

    function upgradeHederaService(IHederaService newHederaService) external;

    function getHederaServiceVersion() external view returns (IHederaService);
}
