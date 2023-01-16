//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "../common/IERC20.sol";

import "hardhat/console.sol";

contract ERC20Mock is IERC20 {
    string tokeName;
    string tokenSymbol;
    uint256 total;
    uint256 userBalance;
    mapping(address => uint256) userBalances;
    bool private transferFailed;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _total,
        uint256 _userBalance
    ) {
        tokeName = _name;
        tokenSymbol = _symbol;
        total = _total;
        userBalance = _userBalance;
        userBalances[address(0)] = _userBalance;
    }

    function setTransaferFailed(bool _transferFailed) public {
        transferFailed = _transferFailed;
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

    function transfer(address from, address to, uint256 amount) public {
        if (userBalances[from] >= amount) {
            userBalances[from] -= amount;
            userBalances[to] += amount;
        }
    }

    function transfer(address, uint256) external view override returns (bool) {
        return !transferFailed;
    }

    function name() external view override returns (string memory) {
        return tokeName;
    }

    function symbol() external view override returns (string memory) {
        return tokenSymbol;
    }
}
