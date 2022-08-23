//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../common/IBaseHTS.sol";
import "../common/hedera/HederaResponseCodes.sol";
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
        swapBFailedSendingA
    }

    bool internal isSuccess;
    int internal trueTransaction = 0;
    FailTransactionFor internal failType;
    constructor(bool _isSucces) {
        isSuccess = _isSucces;
    }

    function setFailType(int _type) public {
        trueTransaction = 0;
        failType = FailTransactionFor(_type);
    }

    function successForType() internal view returns (int) {
        if (failType == FailTransactionFor.initialise) {
            return 4;
        }
        if (failType == FailTransactionFor.initialiseFailATransfer) {
            return 2;
        }
        if (failType == FailTransactionFor.initialiseFailBTransfer) {
            return 3;
        }
        if (failType == FailTransactionFor.swapAFailedSendingB) {
            return 2;
        }
        if (failType == FailTransactionFor.swapBFailedSendingA) {
            return 2;
        }
        if (failType == FailTransactionFor.addLiquidityFailBTransfer) {
            return 3;
        }
        if (failType == FailTransactionFor.removeLiquidityFailBTransfer) {
            return 1;
        }
        return 0;
    }

    function transferTokenPublic(address, address, address, int64) external override returns (int responseCode) {
        if (trueTransaction + successForType() > 0 ) {
            trueTransaction-=1;
            return int(22);
        }
        
        int result = isSuccess ? int(22) : int(23);
        return result;
    }
    
    function associateTokenPublic(address, address) external override returns (int responseCode) {
        if (trueTransaction + successForType() > 0 ) {
            trueTransaction-=1;
            return int(22);
        }
        return (isSuccess) ? int(22) : int(23);
    }
    
    function associateTokensPublic(address, address[] memory) 
        external override view  returns (int responseCode) {
            return (isSuccess) ? int(22) : int(23);
        }
}