//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../common/IBaseHTS.sol";
import "../common/hedera/HederaResponseCodes.sol";

contract MockBaseHTS is IBaseHTS {
    bool internal isSuccess;
    bool internal shouldAlter;
    int internal trueTransaction = 4;
    constructor(bool _isSucces, bool _shouldAlter) {
        isSuccess = _isSucces;
        shouldAlter = _shouldAlter;
    }
    function transferTokenPublic(address, address, address, int64) external override returns (int responseCode) {
        if (trueTransaction > 0) {
            trueTransaction-=1;
            return int(22);
        }
        int result = isSuccess ? int(22) : int(23);
        if (shouldAlter) {
            isSuccess = false;
        }
        return result;
    }
    
    function associateTokenPublic(address, address) external override returns (int responseCode) {
        if (trueTransaction > 0) {
            trueTransaction-=1;
            return int(22);
        }
        return (isSuccess || shouldAlter) ? int(22) : int(23);
    }
    
    function associateTokensPublic(address, address[] memory) 
        external override view  returns (int responseCode) {
            return (isSuccess || shouldAlter) ? int(22) : int(23);
        }
}