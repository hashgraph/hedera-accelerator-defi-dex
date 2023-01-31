// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

library HDMath {
    function sqrt(int256 value) public pure returns (int256 output) {
        int256 modifiedValue = (value + 1) / 2;
        output = value;
        while (modifiedValue < output) {
            output = modifiedValue;
            modifiedValue = (value / modifiedValue + modifiedValue) / 2;
        }
    }
}
