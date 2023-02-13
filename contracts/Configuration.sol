//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableMapUpgradeable.sol";

contract Configuration is OwnableUpgradeable {
    using EnumerableMapUpgradeable for EnumerableMapUpgradeable.UintToUintMap;
    EnumerableMapUpgradeable.UintToUintMap private feeMap;

    function initialize() external initializer {
        __Ownable_init();
        _populateFeeMap();
    }

    function setTransactionFee(
        uint256 _key,
        uint256 _value
    ) external onlyOwner {
        feeMap.set(_key, _value);
    }

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

    function _populateFeeMap() private {
        feeMap.set(1, 5);
        feeMap.set(2, 30);
        feeMap.set(3, 10);
    }
}