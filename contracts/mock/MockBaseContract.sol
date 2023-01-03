//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../common/IBaseHTS.sol";
import "../common/hedera/HederaResponseCodes.sol";
import "./IERC20Mock.sol";
import "./ERC20Mock.sol";
import "hardhat/console.sol";

contract MockBaseHTS is IBaseHTS {
    bool internal tokenTest;
    bool private revertCreateToken;
    int256 private passTransactionCount = 100;
    int256 private successCode = 22;
    int256 private failureCode = 23;

    constructor(bool _tokenTest) {
        tokenTest = _tokenTest;
    }

    function setPassTransactionCount(int256 _passTransactionCount) public {
        passTransactionCount = _passTransactionCount;
    }

    function setRevertCreateToken(bool _revertCreateToken) public {
        revertCreateToken = _revertCreateToken;
    }

    function transferTokenPublic(
        address token,
        address from,
        address to,
        int256 amount
    ) external override returns (int256 responseCode) {
        if (tokenTest) {
            uint256 newAmount = (IERC20Mock(token).balanceOf(from)) -
                uint256(amount);
            IERC20Mock(token).setUserBalance(from, newAmount);
            uint256 newAmountRec = (IERC20Mock(token).balanceOf(to)) +
                uint256(amount);
            IERC20Mock(token).setUserBalance(to, newAmountRec);
        }
        if (passTransactionCount > 0) {
            passTransactionCount -= 1;
            return successCode;
        }
        return failureCode;
    }

    function associateTokenPublic(
        address,
        address
    ) external override returns (int256 responseCode) {
        if (passTransactionCount > 0) {
            passTransactionCount -= 1;
            return successCode;
        }
        return failureCode;
    }

    function associateTokensPublic(
        address,
        address[] memory
    ) external override returns (int256 responseCode) {
        if (passTransactionCount > 0) {
            passTransactionCount -= 1;
            return successCode;
        }
        return failureCode;
    }

    function mintTokenPublic(
        address,
        int256 amount
    ) external override returns (int256 responseCode, int256 newTotalSupply) {
        if (passTransactionCount > 0) {
            passTransactionCount -= 1;
            return (successCode, amount);
        }
        return (failureCode, 0);
    }

    function burnTokenPublic(
        address,
        int256 amount
    ) external override returns (int256 responseCode, int256 newTotalSupply) {
        if (passTransactionCount > 0) {
            passTransactionCount -= 1;
            return (successCode, amount);
        }
        return (failureCode, 0);
    }

    function createFungibleTokenPublic(
        IHederaTokenService.HederaToken memory,
        uint256,
        uint256
    )
        external
        payable
        override
        returns (int256 responseCode, address tokenAddress)
    {
        if (revertCreateToken) {
            revert();
        }
        if (passTransactionCount > 0) {
            passTransactionCount -= 1;
            ERC20Mock mock = new ERC20Mock(10, 10);
            return (successCode, address(mock));
        }
        return (failureCode, address(0));
    }
}
