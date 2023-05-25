//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

abstract contract CommonOperations {
    function join(
        string[] memory items,
        string memory separator
    ) public pure returns (string memory result) {
        uint256 count = items.length;
        if (count > 0) {
            result = items[0];
            for (uint256 i = 1; i < count; i++) {
                result = string.concat(result, separator, items[i]);
            }
        }
    }

    function isOddLengthArray(
        string[] memory items
    ) public pure returns (bool) {
        return items.length % 2 != 0;
    }
}
