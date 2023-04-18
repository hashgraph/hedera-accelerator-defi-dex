//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../common/IBaseHTS.sol";
import "../common/hedera/HederaResponseCodes.sol";
import "./IERC20Mock.sol";
import "./ERC20Mock.sol";
import "hardhat/console.sol";

contract MockBaseHTSWithTokenCreationFail is IBaseHTS {
    function transferTokenPublic(
        address token,
        address sender,
        address receiver,
        int256 amount
    ) external override returns (int256 responseCode) {}

    function associateTokenPublic(
        address account,
        address token
    ) external override returns (int256 responseCode) {}

    function associateTokensPublic(
        address account,
        address[] memory tokens
    ) external override returns (int256 responseCode) {}

    function mintTokenPublic(
        address token,
        int256 amount
    ) external override returns (int256 responseCode, int256 newTotalSupply) {}

    function burnTokenPublic(
        address token,
        int256 amount
    ) external override returns (int256 responseCode, int256 newTotalSupply) {}

    function createFungibleTokenPublic(
        IHederaTokenService.HederaToken memory,
        uint256,
        uint256
    )
        external
        payable
        override
        returns (int256 responseCode, address tokenAddress)
    {
        return (23, address(0x0));
    }

    function hbarxAddress() external override returns (address) {}

    function transferHBAR(
        address payable toAccount
    ) external payable override returns (bool) {}

    function transferNFTPublic(
        address token,
        address sender,
        address receiver,
        int64 serial
    ) external override returns (int256) {}

    function transferViaErc20(
        address from,
        address to,
        address token,
        uint256 amt
    ) external override returns (bool) {}
}
