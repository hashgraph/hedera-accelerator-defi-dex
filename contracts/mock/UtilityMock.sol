//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

contract UtilityMock {
    function compareAddress(
        address firstAddress,
        address secondAddress
    ) public pure returns (address, address) {
        return
            firstAddress < secondAddress
                ? (firstAddress, secondAddress)
                : (secondAddress, firstAddress);
    }
}
