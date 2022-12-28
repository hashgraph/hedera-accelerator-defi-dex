//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./hedera/HederaTokenService.sol";
import "./hedera/HederaResponseCodes.sol";
import "./IBaseHTS.sol";
import "./Bits.sol";

contract BaseHTS is HederaTokenService, IBaseHTS {
    event SenderDetail(address indexed _from, string msg);
    event CreateCalled(address indexed _from, string msg, uint256 value);
    event BurnCalled(address indexed _from, string msg, uint256 value);

    address private _HBARX;
    address private _owner;
    using Bits for uint256;

    modifier onlyOwner() {
        require(_owner == msg.sender, "Only Owner can call this function");
        _;
    }

    constructor() {
        _owner = msg.sender;
    }

    function setupHBARX() public payable onlyOwner returns (address) {
        uint256 supplyKeyType;
        IHederaTokenService.KeyValue memory supplyKeyValue;

        supplyKeyType = supplyKeyType.setBit(4);
        supplyKeyValue.delegatableContractId = address(this);

        IHederaTokenService.TokenKey[]
            memory keys = new IHederaTokenService.TokenKey[](1);
        keys[0] = IHederaTokenService.TokenKey(supplyKeyType, supplyKeyValue);

        IHederaTokenService.Expiry memory expiry;
        expiry.autoRenewAccount = address(this);
        expiry.autoRenewPeriod = 8000000;

        IHederaTokenService.HederaToken memory myToken;
        myToken.name = "HBARX";
        myToken.symbol = "HBAR";
        myToken.treasury = address(this);
        myToken.expiry = expiry;
        myToken.tokenKeys = keys;
        (, address tokenAddress) = _createFungibleToken(myToken, 0, 8);
        _HBARX = tokenAddress;
        return tokenAddress;
    }

    function hbarxAddress() external view override returns (address) {
        return _HBARX;
    }

    function transferTokenPublic(
        address token,
        address sender,
        address receiver,
        int256 amount
    ) external override returns (int256 responseCode) {
        return _transferToken(token, sender, receiver, amount);
    }

    function associateTokenPublic(address account, address token)
        external
        override
        returns (int256 responseCode)
    {
        return _associateToken(account, token);
    }

    function associateTokensPublic(address account, address[] memory tokens)
        external
        override
        returns (int256 responseCode)
    {
        return _associateTokens(account, tokens);
    }

    function mintTokenPublic(address token, int256 amount)
        external
        override
        returns (int256 responseCode, int256 newTotalSupply)
    {
        return _mintToken(token, amount);
    }

    function burnTokenPublic(address token, int256 amount)
        external
        override
        returns (int256 responseCode, int256 newTotalSupply)
    {
        return _burnToken(token, amount);
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
        return _createFungibleToken(token, initialTotalSupply, decimals);
    }

    function createHBARX()
        external
        payable
        override
        returns (int256 responseCode)
    {
        emit CreateCalled(msg.sender, "Create HBARX", msg.value);
        _mintToken(_HBARX, int256(msg.value));
        _transferToken(_HBARX, address(this), msg.sender, int256(msg.value));
        return HederaResponseCodes.SUCCESS;
    }

    function burnHBARX(int256 amount, address payable toAccount)
        external
        payable
        override
        returns (int256 responseCode)
    {
        emit BurnCalled(msg.sender, "Burn HBARX", uint256(amount));
        _burnToken(_HBARX, amount);
        (bool sent, ) = toAccount.call{value: uint256(amount)}("");
        require(sent, "Failed to send Hbar");
        return HederaResponseCodes.SUCCESS;
    }

    function _mintToken(address token, int256 amount)
        private
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

    function _transferToken(
        address token,
        address sender,
        address receiver,
        int256 amount
    ) private returns (int256 responseCode) {
        return
            HederaTokenService.transferToken(
                token,
                sender,
                receiver,
                int64(amount)
            );
    }

    function _associateTokens(address account, address[] memory tokens)
        private
        returns (int256 responseCode)
    {
        return HederaTokenService.associateTokens(account, tokens);
    }

    function _associateToken(address account, address token)
        private
        returns (int256 responseCode)
    {
        return HederaTokenService.associateToken(account, token);
    }

    function _burnToken(address token, int256 amount)
        private
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

    function _createFungibleToken(
        IHederaTokenService.HederaToken memory token,
        uint256 initialTotalSupply,
        uint256 decimals
    ) private returns (int256 responseCode, address tokenAddress) {
        emit SenderDetail(msg.sender, "createFungibleTokenPublic");
        (responseCode, tokenAddress) = createFungibleToken(
            token,
            initialTotalSupply,
            decimals
        );
    }
}
