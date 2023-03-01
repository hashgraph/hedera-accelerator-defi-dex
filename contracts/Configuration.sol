//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableMapUpgradeable.sol";

contract Configuration is OwnableUpgradeable {
    string private constant TWITTER = "TWITTER";
    string private constant DISCORD = "DISCORD";
    string private constant WEBSITE = "WEBSITE";
    string private constant OTHERS = "OTHERS";
    string private constant LINKEDIN = "LINKEDIN";

    using EnumerableMapUpgradeable for EnumerableMapUpgradeable.UintToUintMap;
    EnumerableMapUpgradeable.UintToUintMap private feeMap;
    string[] private urlsKeys;

    error UrlKeyAlreadyExist(string key, string message);

    function initialize() external initializer {
        __Ownable_init();
        _populateFeeMap();
        urlsKeys.push(TWITTER);
        urlsKeys.push(DISCORD);
        urlsKeys.push(WEBSITE);
        urlsKeys.push(OTHERS);
        urlsKeys.push(LINKEDIN);
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

    function addUrlKey(string memory _newKey) public onlyOwner {
        for (uint i = 0; i < urlsKeys.length; i++) {
            if (
                keccak256(abi.encodePacked(urlsKeys[i])) ==
                keccak256(abi.encodePacked(_newKey))
            ) {
                revert UrlKeyAlreadyExist(_newKey, "Url key already exists");
            }
        }
        urlsKeys.push(_newKey);
    }

    function getCommaSeparatedUrlKeys() public view returns (string memory) {
        string memory allKeys = "";
        for (uint i = 0; i < urlsKeys.length; i++) {
            allKeys = string.concat(urlsKeys[i], ",", allKeys);
        }
        return allKeys;
    }

    function _populateFeeMap() private {
        feeMap.set(1, 5);
        feeMap.set(2, 30);
        feeMap.set(3, 10);
    }
}
