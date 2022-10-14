
//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "../common/IERC20.sol";

contract ERC20Mock is IERC20 {
    uint total;
    uint userBalance;

    constructor(uint _total,  uint _userBalance)  {
        total = _total;
        userBalance = _userBalance;
    }

    function totalSupply() external override view returns (uint) {
        return total;
    }

    function balanceOf(address) external override view returns (uint) {
        return userBalance;
    }

    function setTotal(uint _total) external {
        total = _total;
    }

    function setUserBalance(uint _userBalance) external {
        userBalance = _userBalance;
    }

} 