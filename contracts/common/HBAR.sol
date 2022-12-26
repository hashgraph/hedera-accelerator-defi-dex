//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface HBAR {
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);
}
