//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;
import "../common/IERC20.sol";

import "./ITokenType.sol";

contract ERC20Mock is IERC20, ITokenType {
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
        return transferInternal(msg.sender, to, amount);
    }

    function name() external view override returns (string memory) {
        return tokeName;
    }

    function setName(string memory newName) external {
        tokeName = newName;
    }

    function symbol() external view override returns (string memory) {
        return tokenSymbol;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external override returns (bool) {
        return transferInternal(from, to, amount);
    }

    function transferInternal(
        address from,
        address to,
        uint256 amount
    ) private returns (bool) {
        if (
            transferFailed ||
            (isFailTransferAfterCountEnabled && failTransferAfterCount == 0)
        ) {
            return false;
        } else {
            if (isFailTransferAfterCountEnabled) {
                failTransferAfterCount -= 1;
            }
            if (userBalances[from] >= amount) {
                userBalances[from] -= amount;
                userBalances[to] += amount;
            }
            return true;
        }
    }

    function tokenType() external pure override returns (int32) {
        return 0;
    }
}
