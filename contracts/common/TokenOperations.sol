// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "./IERC20.sol";
import "./IERC721.sol";
import "./IHederaService.sol";

contract TokenOperations {
    using Bits for uint256;

    function _balanceOf(
        address token,
        address account
    ) internal view returns (uint256) {
        return IERC20(token).balanceOf(account);
    }

    function _associateToken(
        IHederaService _hederaService,
        address _account,
        address _token
    ) internal returns (int256 code) {
        if (isContract(_account)) {
            return
                associateTokenViaDelegation(_hederaService, _account, _token);
        }
        return _hederaService.associateTokenPublic(_account, _token);
    }

    function _transferToken(
        address _token,
        address _sender,
        address _receiver,
        uint256 _amount
    ) internal returns (int256 responseCode) {
        bool isTransferSuccessful = isContractSendingTokens(_sender)
            ? IERC20(_token).transfer(_receiver, _amount)
            : IERC20(_token).transferFrom(_sender, _receiver, _amount);

        return
            isTransferSuccessful
                ? HederaResponseCodes.SUCCESS
                : HederaResponseCodes.UNKNOWN;
    }

    function _transferNFTToken(
        address _token,
        address _sender,
        address _receiver,
        uint256 _amount
    ) internal {
        IERC721(_token).transferFrom(_sender, _receiver, _amount);
    }

    function isContract(address _account) internal view returns (bool) {
        return _account.code.length > 0;
    }

    /// @custom:oz-upgrades-unsafe-allow delegatecall
    function associateTokenViaDelegation(
        IHederaService _hederaService,
        address _account,
        address _token
    ) private returns (int256 code) {
        (bool success, bytes memory result) = address(_hederaService)
            .delegatecall(
                abi.encodeWithSelector(
                    IHederaService.associateTokenPublic.selector,
                    _account,
                    _token
                )
            );
        code = success
            ? abi.decode(result, (int256))
            : HederaResponseCodes.UNKNOWN;
    }

    function isContractSendingTokens(
        address sender
    ) private view returns (bool) {
        return sender == address(this);
    }

    function createTokenWithContractAsOwner(
        IHederaService _hederaService,
        string memory tokenName,
        string memory tokenSymbol,
        uint256 initialTotalSupply,
        uint256 decimals
    ) internal returns (int256 responseCode, address tokenAddress) {
        uint256 supplyKeyType;
        uint256 adminKeyType;

        IHederaTokenService.KeyValue memory supplyKeyValue;
        supplyKeyType = supplyKeyType.setBit(4);
        supplyKeyValue.delegatableContractId = address(this);

        IHederaTokenService.KeyValue memory adminKeyValue;
        adminKeyType = adminKeyType.setBit(0);
        adminKeyValue.delegatableContractId = address(this);

        IHederaTokenService.TokenKey[]
            memory keys = new IHederaTokenService.TokenKey[](2);

        keys[0] = IHederaTokenService.TokenKey(supplyKeyType, supplyKeyValue);
        keys[1] = IHederaTokenService.TokenKey(adminKeyType, adminKeyValue);

        IHederaTokenService.Expiry memory expiry;
        expiry.autoRenewAccount = address(this);
        expiry.autoRenewPeriod = 8000000;

        IHederaTokenService.HederaToken memory newToken;
        newToken.name = tokenName;
        newToken.symbol = tokenSymbol;
        newToken.treasury = address(this);
        newToken.expiry = expiry;
        newToken.tokenKeys = keys;

        /// @custom:oz-upgrades-unsafe-allow delegatecall
        (bool success, bytes memory result) = address(_hederaService)
            .delegatecall(
                abi.encodeWithSelector(
                    IHederaService.createFungibleTokenPublic.selector,
                    newToken,
                    initialTotalSupply,
                    decimals
                )
            );

        (responseCode, tokenAddress) = success
            ? abi.decode(result, (int256, address))
            : (int256(HederaResponseCodes.UNKNOWN), address(0x0));
    }

    function mintToken(
        IHederaService _hederaService,
        address token,
        uint256 amount
    ) internal returns (int256 responseCode, int64 newTotalSupply) {
        require(
            amount > 0,
            "TokenOperations: Token quantity to mint should be greater than zero."
        );
        /// @custom:oz-upgrades-unsafe-allow delegatecall
        (bool success, bytes memory result) = address(_hederaService)
            .delegatecall(
                abi.encodeWithSelector(
                    IHederaService.mintTokenPublic.selector,
                    token,
                    amount
                )
            );

        (responseCode, newTotalSupply) = success
            ? abi.decode(result, (int256, int64))
            : (int256(HederaResponseCodes.UNKNOWN), int64(0));
    }

    function burnToken(
        IHederaService _hederaService,
        address token,
        uint256 amount
    ) internal returns (int256 responseCode, int64 newTotalSupply) {
        require(
            amount > 0,
            "TokenOperations: Token quantity to burn should be greater than zero."
        );

        /// @custom:oz-upgrades-unsafe-allow delegatecall
        (bool success, bytes memory result) = address(_hederaService)
            .delegatecall(
                abi.encodeWithSelector(
                    IHederaService.burnTokenPublic.selector,
                    token,
                    amount
                )
            );

        (responseCode, newTotalSupply) = success
            ? abi.decode(result, (int256, int64))
            : (int256(HederaResponseCodes.UNKNOWN), int64(0));
    }
}

library Bits {
    uint256 internal constant ONE = uint256(1);

    // Sets the bit at the given 'index' in 'self' to '1'.
    // Returns the modified value.
    function setBit(uint256 self, uint8 index) internal pure returns (uint256) {
        return self | (ONE << index);
    }
}
