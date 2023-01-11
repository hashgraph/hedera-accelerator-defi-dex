//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./common/IBaseHTS.sol";
import "./ILPToken.sol";

abstract contract IPair {
    struct Pair {
        Token tokenA;
        Token tokenB;
    }

    struct Token {
        address tokenAddress;
        int256 tokenQty;
    }

    function getPair() external virtual returns (Pair memory);

    function initialize(
        IBaseHTS _tokenService,
        ILPToken _lpTokenContract,
        address _tokenA,
        address _tokenB,
        address _treasury,
        int256 _fee
    ) public virtual;

    function addLiquidity(
        address fromAccount,
        address _tokenA,
        address _tokenB,
        int256 _tokenAQty,
        int256 _tokenBQty
    ) external virtual payable;

    function removeLiquidity(address payable fromAccount, int256 _lpToken)
        external
        virtual;

    function swapToken(
        address to,
        address _token,
        int256 _deltaQty
    ) external virtual payable;
}
