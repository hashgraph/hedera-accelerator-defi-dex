// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;
import "../common/IERC20.sol";
import "../common/IHederaService.sol";
import "./ITokenHolder.sol";

/**
 * @title The interface for the Token Holder Factory contract.
 */
interface ITokenHolderFactory {
    /**
     * @notice LogicUpdated event.
     * @dev Emitted when the admin updates logic contracts.
     *
     * @param oldImplementation The old implementation contract address.
     * @param newImplementation The new implementation contract address.
     * @param name The event tag.
     */
    event LogicUpdated(
        address indexed oldImplementation,
        address indexed newImplementation,
        string name
    );
    /**
     * @notice TokenHolderCreated event.
     * @dev Emitted when the admin updates DAO info.
     *
     * @param token The token address.
     * @param tokenHolder The token holder contract address.
     */
    event TokenHolderCreated(address token, address tokenHolder);

    /**
     * @dev Initializes the factory with the required parameters.
     *
     * @param _hederaService The address of the Hedera service.
     * @param _tokenHolderLogic The address of token holder logic contract.
     * @param _admin The admin address.
     */
    function initialize(
        IHederaService _hederaService,
        ITokenHolder _tokenHolderLogic,
        address _admin
    ) external;

    /**
     * @dev Returns a token holder for the passed token.
     *
     * @param _token The token address.
     */
    function getTokenHolder(address _token) external returns (ITokenHolder);

    /**
     * @dev Upgrades Token holder logic contract.
     *
     * @param _newImpl The new implementation address.
     */
    function upgradeTokenHolderLogicImplementation(
        ITokenHolder _newImpl
    ) external;
}
