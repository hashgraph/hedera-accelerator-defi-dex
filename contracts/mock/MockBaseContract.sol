//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../common/IBaseHTS.sol";
import "../common/hedera/HederaResponseCodes.sol";
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
    int internal trueTransaction = 0;
    FailTransactionFor internal failType;
    constructor(bool _isSucces) {
        isSuccess = _isSucces;
    }

    function setFailType(int _type) public {
        failType = FailTransactionFor(_type);
        trueTransaction = successForType();
    }

    function successForType() internal view returns (int) {
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

    function transferTokenPublic(address, address, address, int) external override returns (int responseCode) {
        if (trueTransaction > 0) {
            trueTransaction-=1;
            return int(22);
        }
    
        int result = isSuccess ? int(22) : int(23);
        return result;
    }
    
    function associateTokenPublic(address, address) external override returns (int responseCode) {
        if (trueTransaction > 0) {
            trueTransaction-=1;
            return int(22);
        }
        return isSuccess ? int(22) : int(23);
    }
    
    function associateTokensPublic(address, address[] memory) 
        external override view  returns (int responseCode) {
            return isSuccess ? int(22) : int(23);
        }

    function mintTokenPublic(address, int amount) external override
        returns (int responseCode, int newTotalSupply) {
            if (trueTransaction > 0) {
                trueTransaction-=1;
                return (int(22), amount);
            }

            if(isSuccess){
                return (int(22), int(amount));
            }
            revert("Mint Failed");
    }

    function burnTokenPublic(address, int amount) external view override
        returns (int responseCode, int newTotalSupply) {
            return ((isSuccess) ? int(22) : int(23), amount);
    }

    function createFungibleTokenPublic(IHederaTokenService.HederaToken memory , 
        uint , 
        uint) external payable       override
returns (int responseCode, address tokenAddress){
            ERC20Mock mock =  new ERC20Mock(10, 10);
            if (failType == FailTransactionFor.lpTokenCreationFailed) {
                return (int(32),  address(0x0));
            }

            return (int(22),  address(mock));
    }

}