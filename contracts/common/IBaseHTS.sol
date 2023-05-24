//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./hedera/HederaTokenService.sol";
import "./hedera/HederaResponseCodes.sol";

interface IBaseHTS {
    function associateTokenPublic(
        address account,
        address token
    ) external returns (int256 responseCode);

    function mintTokenPublic(
        address token,
        int256 amount
    ) external returns (int256 responseCode, int64 newTotalSupply);

    function burnTokenPublic(
        address token,
        int256 amount
    ) external returns (int256 responseCode, int64 newTotalSupply);

    function createFungibleTokenPublic(
        IHederaTokenService.HederaToken memory token,
        uint256 initialTotalSupply,
        uint256 decimals
    ) external payable returns (int256 responseCode, address tokenAddress);

    function transferHBAR(
        address payable toAccount
    ) external payable returns (bool);
}
