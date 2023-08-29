//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./hedera/HederaTokenService.sol";
import "./hedera/HederaResponseCodes.sol";
import "./IHederaService.sol";

contract HederaService is HederaTokenService, IHederaService {
    uint64 private constant INT_64_MAX_VALUE = 9223372036854775807;
    uint64 private constant INT_32_MAX_VALUE = 2147483647;

    function associateTokenPublic(
        address account,
        address token
    ) external override returns (int256 responseCode) {
        return HederaTokenService.associateToken(account, token);
    }

    function mintTokenPublic(
        address token,
        uint256 amount
    ) external override returns (int256 responseCode, int64 newTotalSupply) {
        bytes[] memory metadata;

        require(
            amount > 0 && amount <= INT_64_MAX_VALUE,
            "Invalid mint value, allowed range greater than zero to int64 max value both end inclusive."
        );

        (int256 responseCodeNew, int64 newTotalSupplyNew, ) = mintToken(
            token,
            int64(uint64(amount)), //Safe to cast as guard check passed
            metadata
        );

        if (responseCodeNew != HederaResponseCodes.SUCCESS) {
            revert("Mint Failed");
        }

        return (responseCodeNew, newTotalSupplyNew);
    }

    function burnTokenPublic(
        address token,
        uint256 amount
    ) external override returns (int256 responseCode, int64 newTotalSupply) {
        int64[] memory serialNumbers;

        require(
            amount > 0 && amount <= INT_64_MAX_VALUE,
            "Invalid burn value, allowed range greater than zero to int64 max value both end inclusive."
        );

        (int256 responseCodeNew, int64 newTotalSupplyNew) = burnToken(
            token,
            int64(uint64(amount)), //Safe to cast as guard check passed
            serialNumbers
        );

        if (responseCodeNew != HederaResponseCodes.SUCCESS) {
            revert("Burn Failed");
        }
        return (responseCodeNew, newTotalSupplyNew);
    }

    function createFungibleTokenPublic(
        IHederaTokenService.HederaToken memory token,
        uint256 initialTotalSupply,
        uint256 decimals
    )
        external
        payable
        override
        returns (int256 responseCode, address tokenAddress)
    {
        require(
            initialTotalSupply >= 0 && initialTotalSupply <= INT_64_MAX_VALUE,
            "Invalid initial total supply value, allowed range 0 to int64 max value both end inclusive."
        );

        require(
            decimals >= 0 && decimals <= INT_32_MAX_VALUE,
            "Invalid decimals value, allowed range 0 to int32 max value both end inclusive."
        );

        (responseCode, tokenAddress) = createFungibleToken(
            token,
            int64(uint64(initialTotalSupply)), //Safe to cast as guard check passed
            int32(uint32(decimals)) //Safe to cast as guard check passed
        );
    }

    function transferHBAR(
        address payable toAccount
    ) external payable override returns (bool) {
        (bool sent, ) = toAccount.call{value: uint256(msg.value)}("");
        return sent;
    }

    function getTokenTypePublic(
        address token
    ) external returns (int64 responseCode, int32 tokenType) {
        return HederaTokenService.getTokenType(token);
    }
}
