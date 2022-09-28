//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IERC20 {
    function totalSupply() external returns (uint);
    function balanceOf(address account) external returns (uint);
}