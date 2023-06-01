//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./common/IHederaService.sol";
import "./ILPToken.sol";
import "./Configuration.sol";

abstract contract IPair {
    struct Pair {
        Token tokenA;
        Token tokenB;
    }

    struct Token {
        address tokenAddress;
        uint256 tokenQty;
    }

    struct Amount {
        uint256 tokenASpotPrice;
        uint256 tokenBSpotPrice;
        uint256 precision;
        uint256 feePrecision;
        uint256 fee;
    }

    function getPair() external virtual returns (Pair memory);

    function initialize(
        IHederaService _hederaService,
        ILPToken _lpTokenContract,
        address _tokenA,
        address _tokenB,
        address _treasury,
        uint256 _fee,
        Configuration _configuration
    ) public virtual;

    function addLiquidity(
        address fromAccount,
        address _tokenA,
        address _tokenB,
        uint256 _tokenAQty,
        uint256 _tokenBQty
    ) external payable virtual;

    function removeLiquidity(
        address payable fromAccount,
        uint256 _lpToken
    ) external virtual;

    function swapToken(
        address to,
        address _token,
        uint256 _deltaQty,
        uint256 _slippage
    ) external payable virtual;

    function getLpTokenContractAddress()
        external
        view
        virtual
        returns (address);

    function upgradeHederaService(
        IHederaService newHederaService
    ) external virtual;

    function getHederaServiceVersion()
        external
        view
        virtual
        returns (IHederaService);
}
