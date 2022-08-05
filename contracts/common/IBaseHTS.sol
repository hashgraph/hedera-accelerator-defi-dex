//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./hedera/HederaTokenService.sol";
import "./hedera/HederaResponseCodes.sol";

interface IBaseHTS {
    function transferTokenPublic(address token, address sender, address receiver, int64 amount) 
        external returns (int responseCode);
    
    function associateTokenPublic(address account, address token) 
        external returns (int responseCode);

    function associateTokensPublic(address account, address[] memory tokens) 
        external returns (int responseCode);
}