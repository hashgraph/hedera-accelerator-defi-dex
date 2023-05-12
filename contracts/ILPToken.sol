//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./common/IBaseHTS.sol";

interface ILPToken {
    function initialize(
        IBaseHTS _tokenService,
        address _owner,
        string memory tokenName,
        string memory tokenSymbol
    ) external payable;

    function allotLPTokenFor(
        int256 amountA,
        int256 amountB,
        address _toUser
    ) external returns (int256 responseCode);

    function removeLPTokenFor(
        int256 lpAmount,
        address fromUser
    ) external returns (int256 responseCode);

    function lpTokenForUser(address _user) external view returns (int256);

    function getLpTokenAddress() external view returns (address);

    function getAllLPTokenCount() external view returns (int256);

    function lpTokenCountForGivenTokensQty(
        int256 tokenAQuantity,
        int256 tokenBQuantity
    ) external view returns (int256);
}
