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
    ) external override returns (int256) {
        if (tokenTest) {
            ERC20Mock(token).transfer(from, to, uint(amount));
        }
        return getResponseCode();
    }

    function associateTokenPublic(
        address,
        address
    ) external override returns (int256) {
        return getResponseCode();
    }

    function associateTokensPublic(
        address,
        address[] memory
    ) external override returns (int256) {
        return getResponseCode();
    }

    function mintTokenPublic(
        address,
        int256 amount
    ) external override returns (int256, int256) {
        return (getResponseCode(), amount);
    }

    function burnTokenPublic(
        address,
        int256 amount
    ) external override returns (int256, int256) {
        return (getResponseCode(), amount);
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
        responseCode = getResponseCode();
        if (responseCode == 22) {
            tokenAddress = address(new ERC20Mock(10, 10));
        }
        return (responseCode, tokenAddress);
    }

    function getResponseCode() private returns (int) {
        if (passTransactionCount > 0) {
            passTransactionCount -= 1;
            return int(22);
        }
        return int(23);
    }
}
