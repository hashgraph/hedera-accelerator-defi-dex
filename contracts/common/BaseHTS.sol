//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./hedera/HederaTokenService.sol";
import "./hedera/HederaResponseCodes.sol";


contract BaseHTS is HederaTokenService {

    function transferTokenPublic(address token, address sender, address receiver, int64 amount) 
        external returns (int responseCode) {
            return HederaTokenService.transferToken(token, sender, receiver, amount);
        }
    
    function associateTokenPublic(address account, address token) external returns (int responseCode) {
        return HederaTokenService.associateToken(account, token);
    }
    
    function associateTokensPublic(address account, address[] memory tokens) 
        external returns (int responseCode) {
            return HederaTokenService.associateTokens(account, tokens);
    }
    
    function mintTokenPublic(address token, uint64 amount) external
        returns (int responseCode, uint64 newTotalSupply) {
            bytes[] memory metadata;
            (int responseCodeNew, uint64 newTotalSupplyNew, ) = HederaTokenService.mintToken(token, amount, metadata);
            return (responseCodeNew, newTotalSupplyNew);
    }

    function burnTokenPublic(address token, uint64 amount) external
        returns (int responseCode, uint64 newTotalSupply) {
            int64[] memory serialNumbers;
            return HederaTokenService.burnToken(token, amount, serialNumbers);
    }

}