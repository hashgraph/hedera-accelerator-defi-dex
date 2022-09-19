
//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "../common/IERC20.sol";

contract ERC20Mock is IERC20 {
    function totalSupply() external override pure returns (uint) {
        return 100;
    }

    function balanceOf(address) external override pure returns (uint) {
        return 10;
    }

} 