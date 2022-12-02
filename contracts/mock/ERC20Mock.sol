//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "../common/IERC20.sol";

contract ERC20Mock is IERC20 {
    uint256 total;
    uint256 userBalance;
    mapping(address => uint256) userBalances;

    constructor(uint256 _total, uint256 _userBalance) {
        total = _total;
        userBalance = _userBalance;
        userBalances[address(0)] = _userBalance;
    }

    function totalSupply() external view override returns (uint256) {
        return total;
    }

    function balanceOf(address user) external view override returns (uint256) {
        if (userBalances[user] != 0) {
            return userBalances[user];
        }
        return userBalance;
    }

    function setTotal(uint256 _total) external {
        total = _total;
    }

    function setUserBalance(address _user, uint256 _userBalance) external {
        userBalance = _userBalance;
        userBalances[_user] = _userBalance;
    }
}
