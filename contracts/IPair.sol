//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./common/IBaseHTS.sol";
import "./ILPToken.sol";
import "./Configuration.sol";

abstract contract IPair {
    struct Pair {
        Token tokenA;
        Token tokenB;
    }

    struct Token {
        address tokenAddress;
        int256 tokenQty;
    }

    struct Amount {
        int256 tokenASpotPrice;
        int256 tokenBSpotPrice;
        int256 precision;
        int256 feePrecision;
        int256 fee;
    }

    function getPair() external virtual returns (Pair memory);

    function initialize(
        IBaseHTS _tokenService,
        ILPToken _lpTokenContract,
        address _tokenA,
        address _tokenB,
        address _treasury,
        int256 _fee,
        Configuration _configuration
    ) public virtual;

    function addLiquidity(
        address fromAccount,
        address _tokenA,
        address _tokenB,
        int256 _tokenAQty,
        int256 _tokenBQty
    ) external payable virtual;

    function removeLiquidity(
        address payable fromAccount,
        int256 _lpToken
    ) external virtual;

    function swapToken(
        address to,
        address _token,
        int256 _deltaQty,
        int256 _slippage
    ) external payable virtual;

    function getLpTokenContractAddress()
        external
        view
        virtual
        returns (address);
}
