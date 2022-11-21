//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../common/IBaseHTS.sol";
import "../common/hedera/HederaResponseCodes.sol";
import "./IERC20Mock.sol";
import "./ERC20Mock.sol";
import "hardhat/console.sol";

contract MockBaseHTS is IBaseHTS {
    enum FailTransactionFor {
        initialise,
        swapAFailedSendingA,
        swapAFailedSendingB,
        addLiquidity,
        addLiquidityFailBTransfer,
        removeLiquidityFailBTransfer,
        removeLiquidity,
        initialiseFailATransfer,
        initialiseFailBTransfer,
        swapBFailedSendingA,
        addLiquidityFailMinting,
        addLiquidityLPTransferFail,
        swapBFailedSendingB,
        lpTokenCreationFailed
    }

    bool internal isSuccess;
    bool internal tokenTest;
    int256 internal trueTransaction = 0;
    FailTransactionFor internal failType;

    constructor(bool _isSucces, bool _tokenTest) {
        isSuccess = _isSucces;
        tokenTest = _tokenTest;
    }

    function setFailType(int256 _type) public {
        failType = FailTransactionFor(_type);
        trueTransaction = successForType();
    }

    function successForType() internal view returns (int256) {
        if (failType == FailTransactionFor.initialise) {
            return 7;
        }
        if (failType == FailTransactionFor.initialiseFailATransfer) {
            return 2;
        }
        if (failType == FailTransactionFor.initialiseFailBTransfer) {
            return 3;
        }
        if (failType == FailTransactionFor.swapAFailedSendingB) {
            return 8;
        }
        if (failType == FailTransactionFor.swapBFailedSendingA) {
            return 9;
        }
        if (failType == FailTransactionFor.addLiquidityFailBTransfer) {
            return 3;
        }
        if (failType == FailTransactionFor.removeLiquidityFailBTransfer) {
            return 1;
        }
        if (failType == FailTransactionFor.addLiquidityFailMinting) {
            return 5;
        }
        if (failType == FailTransactionFor.addLiquidityLPTransferFail) {
            return 6;
        }
        if (failType == FailTransactionFor.swapBFailedSendingB) {
            return 7;
        }
        if (failType == FailTransactionFor.lpTokenCreationFailed) {
            return 1;
        }
        return 0;
    }

    function transferTokenPublic(
        address token,
        address from,
        address to,
        int256 amount
    ) external override returns (int256 responseCode) {
        if (tokenTest) {
            uint256 newAmount = (IERC20Mock(token).balanceOf(from)) - uint256(amount);
            IERC20Mock(token).setUserBalance(from, newAmount);
            uint256 newAmountRec = (IERC20Mock(token).balanceOf(to)) + uint256(amount);
            IERC20Mock(token).setUserBalance(to, newAmountRec);      
        }
        if (trueTransaction > 0) {
            trueTransaction -= 1;
            return int256(22);
        }

        int256 result = isSuccess ? int256(22) : int256(23);
        return result;
    }

    function associateTokenPublic(address, address)
        external
        override
        returns (int256 responseCode)
    {
        if (trueTransaction > 0) {
            trueTransaction -= 1;
            return int256(22);
        }
        return isSuccess ? int256(22) : int256(23);
    }

    function associateTokensPublic(address, address[] memory)
        external
        view
        override
        returns (int256 responseCode)
    {
        return isSuccess ? int256(22) : int256(23);
    }

    function mintTokenPublic(address, int256 amount)
        external
        override
        returns (int256 responseCode, int256 newTotalSupply)
    {
        if (trueTransaction > 0) {
            trueTransaction -= 1;
            return (int256(22), amount);
        }

        if (isSuccess) {
            return (int256(22), int256(amount));
        }
        revert("Mint Failed");
    }

    function burnTokenPublic(address, int256 amount)
        external
        view
        override
        returns (int256 responseCode, int256 newTotalSupply)
    {
        return ((isSuccess) ? int256(22) : int256(23), amount);
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
        ERC20Mock mock = new ERC20Mock(10, 10);
        if (failType == FailTransactionFor.lpTokenCreationFailed) {
            return (int256(32), address(0x0));
        }

        return (int256(22), address(mock));
    }
}
