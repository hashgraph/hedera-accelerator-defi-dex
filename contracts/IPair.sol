//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./common/IHederaService.sol";
import "./ILPToken.sol";
import "./Configuration.sol";

/**
 * @title The abstract contract for a Pair contract.
 */
abstract contract IPair {
    // Pair struct
    struct Pair {
        Token tokenA;
        Token tokenB;
    }

    // Token struct
    struct Token {
        address tokenAddress;
        uint256 tokenQty;
    }

    // Amount struct
    struct Amount {
        uint256 tokenASpotPrice;
        uint256 tokenBSpotPrice;
        uint256 precision;
        uint256 feePrecision;
        uint256 fee;
    }

    /**
     * @dev Returns the Pair struct with info.
     */
    function getPair() external virtual returns (Pair memory);

    /**
     * @dev Initializes the Pair contract with required parameters.
     *
     * @param _hederaService The address of the Hedera service.
     * @param _lpTokenContract The Pair struct.
     * @param _tokenA The A token of the Pair.
     * @param _tokenB The B token of the Pair.
     * @param _treasury The treasury address.
     * @param _fee The fee asigned to the Pair.
     * @param _configuration The configuration contract address.
     */
    function initialize(
        IHederaService _hederaService,
        ILPToken _lpTokenContract,
        address _tokenA,
        address _tokenB,
        address _treasury,
        uint256 _fee,
        Configuration _configuration
    ) public virtual;

    /**
     * @dev Adds liquidity to the pool.
     *
     * @param fromAccount The from account address.
     * @param _tokenA The A token of the Pair.
     * @param _tokenB The B token of the Pair.
     * @param _tokenAQty The A token amount to add.
     * @param _tokenBQty The B token amount to add.
     */
    function addLiquidity(
        address fromAccount,
        address _tokenA,
        address _tokenB,
        uint256 _tokenAQty,
        uint256 _tokenBQty
    ) external payable virtual;

    /**
     * @dev Removes liquidity from the pool.
     *
     * @param fromAccount The from account address.
     * @param _lpToken The amount of the LP token.
     */
    function removeLiquidity(
        address payable fromAccount,
        uint256 _lpToken
    ) external virtual;

    /**
     * @dev Performs the swap of the passed token.
     *
     * @param to The to account address.
     * @param _token The token to swap.
     * @param _deltaQty The amount to swap.
     * @param _slippage The slippage value.
     */
    function swapToken(
        address to,
        address _token,
        uint256 _deltaQty,
        uint256 _slippage
    ) external payable virtual;

    /**
     * @dev Returns the address of the LP token contract.
     */
    function getLpTokenContractAddress()
        external
        view
        virtual
        returns (address);

    /**
     * @dev Upgrades the current Hedera service.
     *
     * @param newHederaService The new Hedera service.
     */
    function upgradeHederaService(
        IHederaService newHederaService
    ) external virtual;

    /**
     * @dev Returns the address of the current Hedera service.
     */
    function getHederaServiceVersion()
        external
        view
        virtual
        returns (IHederaService);
}
