//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../common/IBaseHTS.sol";
import "../common/hedera/HederaResponseCodes.sol";

contract MockBaseHTS is IBaseHTS {
    bool isSuccess;
    constructor(bool _isSucces) {
        isSuccess = _isSucces;
    }
    function transferTokenPublic(address, address, address, int64) 
        external view override
returns (int responseCode) {
            return isSuccess ? int(22) : int(23);
        }
    
    function associateTokenPublic(address, address) external override view returns (int responseCode) {
        return isSuccess ? int(22) : int(23);
    }
    
    function associateTokensPublic(address, address[] memory) 
        external override view  returns (int responseCode) {
            return isSuccess ? int(22) : int(23);
        }
}