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
        addLiquidityFailATransfer,
        removeLiquidityFailATransfer,
        swapBFailedSendingA,
        addLiquidityFailMinting,
        addLiquidityLPTransferFail,
        swapBFailedSendingB,
        lpTokenCreationFailed,
        failedTransferToken,
        vaultAddRewardFailExistCase,
        vaultAddRewardFailNotExistCase,
        vaultAddStakeFailExistCase
    }// 17

    bool internal isSuccess;
    bool internal tokenTest;
    int256 internal trueTransaction = 0;
    FailTransactionFor internal failType;
    int256 public returnResponseCode = 23;
    address private hbarx;

    constructor(bool _isSucces, bool _tokenTest, address _hbarx) {
        isSuccess = _isSucces;
        tokenTest = _tokenTest;
        hbarx = _hbarx;
    }

    function setSuccessStatus(bool _success) public {
        isSuccess = _success;
    }

    function setTrueTransactionCount(int256 _trueTransaction) public {
        trueTransaction = _trueTransaction;
    }

    function setFailType(int256 _type) public {
        failType = FailTransactionFor(_type);
        trueTransaction = successForType();
    }

    function setFailResponseCode(int256 code) public {
        returnResponseCode = code;
    }

    function successForType() internal view returns (int256) {
        if (failType == FailTransactionFor.initialise) {
            return 7;
        }
        if (failType == FailTransactionFor.addLiquidityFailATransfer) {
            return 1;
        }
        if (failType == FailTransactionFor.removeLiquidityFailATransfer) {
            return 0;
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
        if (failType == FailTransactionFor.failedTransferToken) {
            return 1;
        }
        if (failType == FailTransactionFor.vaultAddRewardFailExistCase) {
            return 1;
        }
        if (failType == FailTransactionFor.vaultAddStakeFailExistCase) {
            return 2;
        }
        
        return 0;
    }

    function transferTokenPublic(
        address token,
        address from,
        address to,
        int256 amount
    ) external override returns (int256 responseCode) {
        return _transferToken(token, from, to, amount);
    }

    function _transferToken(
        address token,
        address from,
        address to,
        int256 amount
    ) private returns (int256 responseCode) {
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

    function mintTokenPublic(address token, int256 amount)
        external
        override
        returns (int256 responseCode, int256 newTotalSupply)
    {
       return _mintToken(token, amount);
    }

    function _mintToken(address token, int256 amount)
        private
        returns (int256 responseCode, int256 newTotalSupply)
    {
        if (trueTransaction > 0) {
            trueTransaction -= 1;
            return (int256(22), amount);
        }
        return (isSuccess ? int256(22) : int256(23), int256(amount));
    }

    function burnTokenPublic(address token, int256 amount)
        external
        view
        override
        returns (int256 responseCode, int256 newTotalSupply)
    {
        return _burnToken(token, amount);
    }

    function _burnToken(address token, int256 amount)
        private
        view
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
            if (returnResponseCode == 32) {
                revert("Can not create token");
            }
            return (int256(23), address(0x0));
        }

        return (int256(22), address(mock));
    }

    function hbarxAddress() external override view returns(address) {
        return hbarx;
    }
    function createHBARX() external override payable returns (int256 responseCode) {
        if (trueTransaction > 0) {
            trueTransaction -= 1;
            return int256(22);
        }
        return isSuccess ? int256(22) : int256(23);
    }

    function burnHBARX(int256 amount, address payable ) external override payable returns (int256 responseCode) {
        
        if (trueTransaction > 0) {
            trueTransaction -= 1;
            return int256(22);
        }
        return isSuccess ? int256(22) : int256(23);
    }

}
