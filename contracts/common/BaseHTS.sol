//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./hedera/HederaTokenService.sol";
import "./hedera/HederaResponseCodes.sol";
import "./IBaseHTS.sol";

contract BaseHTS is HederaTokenService, IBaseHTS {
    event SenderDetail(address indexed _from, string msg);

    address private constant _HBARX = address(0x0000000000000000000000000000000002eeff69);

    function hbarxAddress() external pure override returns (address) {
        return _HBARX;
    }

    function transferTokenPublic(
        address token,
        address sender,
        address receiver,
        int256 amount
    ) external override returns (int256) {
        return
            HederaTokenService.transferToken(
                token,
                sender,
                receiver,
                int64(amount)
            );
    }

    function associateTokenPublic(address account, address token)
        external
        override
        returns (int256 responseCode)
    {
        return HederaTokenService.associateToken(account, token);
    }

    function associateTokensPublic(address account, address[] memory tokens)
        external
        override
        returns (int256 responseCode)
    {
        return HederaTokenService.associateTokens(account, tokens);
    }

    function mintTokenPublic(address token, int256 amount)
        external
        override
        returns (int256 responseCode, int256 newTotalSupply)
    {
        emit SenderDetail(msg.sender, "mintToken");
        bytes[] memory metadata;

        (int256 responseCodeNew, uint64 newTotalSupplyNew, ) = mintToken(
            token,
            uint64(uint256(amount)),
            metadata
        );

        if (responseCodeNew != HederaResponseCodes.SUCCESS) {
            revert("Mint Failed");
        }

        return (responseCodeNew, int256(uint256(newTotalSupplyNew)));
    }

    function burnTokenPublic(address token, int256 amount)
        external
        override
        returns (int256 responseCode, int256 newTotalSupply)
    {
         int64[] memory serialNumbers;
        (int256 responseCodeNew, uint64 newTotalSupplyNew) = HederaTokenService
            .burnToken(token, uint64(uint256(amount)), serialNumbers);
        if (responseCodeNew != HederaResponseCodes.SUCCESS) {
            revert("Burn Failed");
        }
        return (responseCodeNew, int256(uint256(newTotalSupplyNew)));
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
        emit SenderDetail(msg.sender, "createFungibleTokenPublic");
        (responseCode, tokenAddress) = createFungibleToken(
            token,
            initialTotalSupply,
            decimals
        );
    }

    function transferHBAR(int256 amount, address payable toAccount)
        external
        payable
        override
        returns (int256 responseCode)
    {
        (bool sent, ) = toAccount.call{value: uint256(amount)}("");
        return sent ? HederaResponseCodes.SUCCESS : HederaResponseCodes.FAIL_INVALID;
    }
}
