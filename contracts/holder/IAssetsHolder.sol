// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "../common/IHederaService.sol";

/**
 * @title The interface for the Assets Holder contract.
 */
interface IAssetsHolder {
    /**
     * @dev Initializes the contract with required parameters.
     *
     * @param _governanceToken The governance token address.
     * @param _iHederaService The address of the Hedera service.
     */
    function initialize(
        address _governanceToken,
        IHederaService _iHederaService
    ) external;

    /**
     * @dev Associates the token.
     *
     * @param _token The token to associate.
     */
    function associate(address _token) external;

    /**
     * @dev Creates a token.
     *
     * @param _name The token name.
     * @param _symbol The token symbol.
     * @param _initialTotalSupply The token initial total supply.
     */
    function createToken(
        string memory _name,
        string memory _symbol,
        uint256 _initialTotalSupply
    ) external payable;

    /**
     * @dev Mints the token.
     *
     * @param _token The token to mint.
     * @param _amount The amount to mint.
     */
    function mintToken(address _token, uint256 _amount) external;

    /**
     * @dev Burns the token.
     *
     * @param _token The token to burn.
     * @param _amount The amount to burn.
     */
    function burnToken(address _token, uint256 _amount) external;

    /**
     * @dev Transfers the token to the address.
     *
     * @param _to The receiver address.
     * @param _token The token to transfer.
     * @param _amount The amount to transfer.
     */
    function transfer(address _to, address _token, uint256 _amount) external;

    function setText() external;

    /**
     * @dev Upgrades the proxy.
     *
     * @param _proxy The proxy address.
     * @param _proxyLogic The proxy logic address.
     * @param _proxyAdmin The proxy admin address.
     */
    function upgradeProxy(
        address _proxy,
        address _proxyLogic,
        address _proxyAdmin
    ) external;

    /**
     * @dev Upgrades the current Hedera service.
     *
     * @param _newIHederaService The new Hedera service.
     */
    function upgradeHederaService(IHederaService _newIHederaService) external;

    /**
     * @dev Returns the address of the current Hedera service.
     */
    function getHederaServiceVersion() external view returns (IHederaService);
}
