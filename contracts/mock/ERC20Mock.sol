
//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract ERC20Mock {
    function totalSupply() external pure returns (uint) {
        return 100;
    }

    function balanceOf(address account) external pure returns (uint) {
        return 10;
    }

} 