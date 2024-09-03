//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./common/IEvents.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableMapUpgradeable.sol";

/**
 * @title Configuration
 *
 * The contract allows owner to change HBARX address and manage transaction fees.
 */
contract Configuration is IEvents, OwnableUpgradeable {
    // HBARX event tag
    string private constant HBARX_ADDRESS = "HBARX_ADDRESS";

    using EnumerableMapUpgradeable for EnumerableMapUpgradeable.UintToUintMap;
    // Fee map
    EnumerableMapUpgradeable.UintToUintMap private feeMap;
    // HBARX address
    address private hbarxAddress;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract with the required parameters.
     */
    function initialize() external initializer {
        __Ownable_init();
        _populateFeeMap();
        hbarxAddress = address(0x0000000000000000000000000000000000013925);
        emit LogicUpdated(address(0), hbarxAddress, HBARX_ADDRESS);
    }

    /**
     * @dev Sets a fee for the target transaction type.
     *
     * @param _key The fee key.
     * @param _value The fee value.
     */
    function setTransactionFee(
        uint256 _key,
        uint256 _value
    ) external onlyOwner {
        feeMap.set(_key, _value);
    }

    /**
     * @dev Returns the current HBARX address.
     */
    function getHbarxAddress() external view returns (address) {
        return hbarxAddress;
    }

    /**
     * @dev Sets the HBARX address.
     *
     * @param newAddress The new HBARX address.
     */
    function setHbarxAddress(address newAddress) external onlyOwner {
        emit LogicUpdated(hbarxAddress, newAddress, HBARX_ADDRESS);
        hbarxAddress = newAddress;
    }

    /**
     * @dev Returns the current transaction fees.
     *
     * @return feeItems The array of txs and it's fees in a flattened format.
     */
    function getTransactionsFee()
        external
        view
        returns (uint256[] memory feeItems)
    {
        uint256 count = feeMap.length();
        feeItems = new uint256[](count * 2);
        for (uint i = 0; i < count; i++) {
            (uint256 key, uint256 value) = feeMap.at(i);
            feeItems[i * 2] = key;
            feeItems[i * 2 + 1] = value;
        }
    }

    /**
     * @dev Populates the initial transaction fees.
     * @notice Using only during the deployment phase.
     */
    function _populateFeeMap() private {
        require(feeMap.set(1, 5), "Configuration: failed to set fee 5");
        require(feeMap.set(2, 30), "Configuration: failed to set fee 30");
        require(feeMap.set(3, 10), "Configuration: failed to set fee 10");
    }
}
