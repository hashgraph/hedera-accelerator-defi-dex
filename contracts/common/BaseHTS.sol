//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./hedera/HederaTokenService.sol";
import "./hedera/HederaResponseCodes.sol";
import "./IBaseHTS.sol";


contract BaseHTS is HederaTokenService, IBaseHTS {

    function transferTokenPublic(address token, address sender, address receiver, int amount) 
        external       override
returns (int responseCode) {
            return HederaTokenService.transferToken(token, sender, receiver, int64(amount));
        }
    
    function associateTokenPublic(address account, address token) external override returns (int responseCode) {
        return HederaTokenService.associateToken(account, token);
    }
    
    function associateTokensPublic(address account, address[] memory tokens) 
        external       override
returns (int responseCode) {
            return HederaTokenService.associateTokens(account, tokens);
    }
    
    function mintTokenPublic(address token, int amount) external override
        returns (int responseCode, int newTotalSupply) {
            bytes[] memory metadata;
            (int responseCodeNew, uint64 newTotalSupplyNew, ) = HederaTokenService.mintToken(token, uint64(uint(amount)), metadata);
            return (responseCodeNew, int(uint(newTotalSupplyNew)));
    }

    function burnTokenPublic(address token, int amount) external override
        returns (int responseCode, int newTotalSupply) {
            int64[] memory serialNumbers; 
             (int responseCodeNew, uint64 newTotalSupplyNew) = HederaTokenService.burnToken(token, uint64(uint(amount)), serialNumbers);
            return (responseCodeNew, int(uint(newTotalSupplyNew)));
    }
}