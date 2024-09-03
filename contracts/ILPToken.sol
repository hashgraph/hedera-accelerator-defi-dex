//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./common/IHederaService.sol";

/**
 * @title The interface for the LP token contract.
 */
interface ILPToken {
    /**
     * @dev Initializes the LP token with the required parameters.
     *
     * @param _hederaService The address of the Hedera service.
     * @param _owner The address of the LP token contract owner.
     * @param tokenName The LP token name.
     * @param tokenSymbol The LP token symbol.
     */
    function initialize(
        IHederaService _hederaService,
        address _owner,
        string memory tokenName,
        string memory tokenSymbol
    ) external payable;

    /**
     * @dev Mints and transfers LP tokens to a specified user when they add liquidity to the pool.
     *
     * @param tokenAQtyPresentInPool The amount of A token in the pool.
     * @param tokenBQtyPresentInPool The The amount of B token in the pool.
     * @param amountA The amount of A token.
     * @param amountB The The amount of B token.
     * @param _toUser The address of a user.
     */
    function allotLPTokenFor(
        uint256 tokenAQtyPresentInPool,
        uint256 tokenBQtyPresentInPool,
        uint256 amountA,
        uint256 amountB,
        address _toUser
    ) external;

    /**
     * @dev Transfers LP tokens from a user and burns.
     *
     * @param lpAmount The amount of the LP token to remove from the user.
     * @param fromUser The address of the from user.
     */
    function removeLPTokenFor(uint256 lpAmount, address fromUser) external;

    /**
     * @dev Returns LP token balance for the user.
     *
     * @param _user The user address.
     * @return The user balance.
     */
    function lpTokenForUser(address _user) external view returns (uint256);

    /**
     * @dev Returns LP token address.
     */
    function getLpTokenAddress() external view returns (address);

    /**
     * @dev Returns the LP token total supply.
     */
    function getAllLPTokenCount() external view returns (uint256);

    /**
     * @dev Calculates the amount of liquidity pool tokens that should be provided
     * when a user adds a certain quantity of tokenA and tokenB to a pool.
     *
     * @param tokenAQtyPresentInPool The amount of A token in the pool.
     * @param tokenBQtyPresentInPool The The amount of B token in the pool.
     * @param tokenAQuantity The amount of A token.
     * @param tokenBQuantity The The amount of B token.
     */
    function lpTokenCountForGivenTokensQty(
        uint256 tokenAQtyPresentInPool,
        uint256 tokenBQtyPresentInPool,
        uint256 tokenAQuantity,
        uint256 tokenBQuantity
    ) external view returns (uint256);

    /**
     * @dev Upgrades the current Hedera service.
     *
     * @param newHederaService The new Hedera service.
     */
    function upgradeHederaService(IHederaService newHederaService) external;

    /**
     * @dev Returns the address of the current Hedera service.
     */
    function getHederaServiceVersion() external view returns (IHederaService);
}
