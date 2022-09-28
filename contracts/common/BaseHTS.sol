//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./hedera/HederaTokenService.sol";
import "./hedera/HederaResponseCodes.sol";
import "./IBaseHTS.sol";


contract BaseHTS is HederaTokenService, IBaseHTS {
    event SenderDetail(address indexed _from, string msg);

    function transferTokenPublic(address token, address sender, address receiver, int amount) 
        external       override
returns (int responseCode) {
            responseCode =  HederaTokenService.transferToken(token, sender, receiver, int64(amount));
            if (responseCode != HederaResponseCodes.SUCCESS) {
                revert ("Transfer token failed.");
            }
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
            emit SenderDetail(msg.sender, "mintTokenPublic");
            bytes[] memory metadata;
        
            (int responseCodeNew, uint64 newTotalSupplyNew, ) = mintToken(token, uint64(uint(amount)), metadata);

            if (responseCodeNew != HederaResponseCodes.SUCCESS) {
                revert ("Mint Failed");
            }

            return (responseCodeNew, int(uint(newTotalSupplyNew)));
    }

    function burnTokenPublic(address token, int amount) external override
        returns (int responseCode, int newTotalSupply) {
            int64[] memory serialNumbers; 
            (int responseCodeNew, uint64 newTotalSupplyNew) = HederaTokenService.burnToken(token, uint64(uint(amount)), serialNumbers);
            if (responseCodeNew != HederaResponseCodes.SUCCESS) {
                revert ("Burn Failed");
            }
            return (responseCodeNew, int(uint(newTotalSupplyNew)));
    }

    function createFungibleTokenPublic(
        IHederaTokenService.HederaToken memory token,
        uint256 initialTotalSupply,
        uint256 decimals
    )
        external
        payable
        override
        returns (int256 responseCode, address tokenAddress) {
        emit SenderDetail(msg.sender, "createFungibleTokenPublic");
        (responseCode, tokenAddress) = createFungibleToken(
            token,
            initialTotalSupply,
            decimals
        );

        if (responseCode != HederaResponseCodes.SUCCESS) {
                revert ("createFungibleToken Failed");
            }
    }
}