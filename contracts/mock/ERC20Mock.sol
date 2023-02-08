//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "../common/IERC20.sol";

import "hardhat/console.sol";

contract ERC20Mock is IERC20 {
    string tokeName;
    string tokenSymbol;
    uint256 total;
    mapping(address => uint256) userBalances;
    bool private transferFailed;
    int failTransferAfterCount;
    bool isFailTransferAfterCountEnabled;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _total,
        uint256 _userBalance
    ) {
        tokeName = _name;
        tokenSymbol = _symbol;
        total = _total;
        userBalances[address(0)] = _userBalance;
    }

    function setTransaferFailed(bool _transferFailed) public {
        transferFailed = _transferFailed;
    }

    function failTransferAfterNSuccessfulTransfers(
        int _failTransferAfterCount
    ) public {
        failTransferAfterCount = _failTransferAfterCount;
        isFailTransferAfterCountEnabled = true;
    }

    function totalSupply() external view override returns (uint256) {
        return total;
    }

    function balanceOf(address user) external view override returns (uint256) {
        return userBalances[user];
    }

    function setTotal(uint256 _total) external {
        total = _total;
    }

    function setUserBalance(address _user, uint256 _userBalance) external {
        userBalances[_user] = _userBalance;
    }

    function transfer(address from, address to, uint256 amount) public {
        if (userBalances[from] >= amount) {
            userBalances[from] -= amount;
            userBalances[to] += amount;
        }
    }

    function transfer(
        address to,
        uint256 amount
    ) external override returns (bool) {
        if (
            transferFailed ||
            (isFailTransferAfterCountEnabled && failTransferAfterCount == 0)
        ) {
            return false;
        } else {
            if (isFailTransferAfterCountEnabled) {
                failTransferAfterCount -= 1;
            }
            if (userBalances[msg.sender] >= amount) {
                userBalances[msg.sender] -= amount;
                userBalances[to] += amount;
            }
            return true;
        }
    }

    function name() external view override returns (string memory) {
        return tokeName;
    }

    function symbol() external view override returns (string memory) {
        return tokenSymbol;
    }
}
