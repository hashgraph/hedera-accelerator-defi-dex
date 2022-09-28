//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./common/hedera/HederaResponseCodes.sol";
import "./common/IBaseHTS.sol";
import "./common/IERC20.sol";
import "./common/hedera/HederaTokenService.sol";
import "./ILPToken.sol";

abstract contract AbstractLPToken is HederaResponseCodes, ILPToken {
    IBaseHTS tokenService;
    address internal creator;
    IERC20 lpToken;

     using Bits for uint;

    event SenderDetail(address indexed _from, string msg);

    function lpTokenForUser(address _user) external override returns(int) {
        return int(lpToken.balanceOf(_user));
    }

    function getLpTokenAddress() external view returns(address) {
        return address(lpToken);
    }

    function getAllLPTokenCount() external override returns(int) {
        return int(lpToken.totalSupply());
    }

    function mintToken(int amount, address tokenToMint) internal virtual returns (int responseCode, int newTotalSupply); 
    function associateTokenInternal(address account,  address _token) internal virtual returns(int);
    function transferTokenInternal(address _token, address sender, address receiver, int amount) internal virtual returns(int);
    function burnToken(int amount, address tokenToBurn) internal virtual returns (int); 
    function createFungibleTokenInternal(IHederaTokenService.HederaToken memory hederaToken,
        uint256 initialTotalSupply,
        uint256 decimals) internal virtual returns (int responseCode, address tokenAddress);

    function initializeParams(IBaseHTS _tokenService) external payable {
         tokenService = _tokenService;
        (, address newToken) = createFungibleTokenPublic(0);
        lpToken = IERC20(newToken);
    }
     
    function allotLPTokenFor(int amountA, int amountB, address _toUser) external override returns (int responseCode) {
        emit SenderDetail(msg.sender,  "allotLPTokenFor");
        require((amountA > 0 && amountB > 0), "Please provide positive token counts" );
        int mintingAmount = sqrt(amountB * amountB);
        require(address(lpToken) > address(0x0), "Liquidity Token not initialized");
        associateTokenInternal(_toUser, address(lpToken));
        mintToken(mintingAmount, address(lpToken));
        transferTokenInternal(address(lpToken), address(tokenService), _toUser, mintingAmount);
        return HederaResponseCodes.SUCCESS;
    }

    function removeLPTokenFor(int lpAmount, address fromUser) external override returns (int responseCode) {
        require(address(lpToken) > address(0x0), "Liquidity Token not initialized");
        require((lpAmount > 0), "Please provide token counts" );
        require(this.lpTokenForUser(fromUser) > lpAmount, "User Does not have lp amount" );
        // transfer Lp from users account to contract
        transferTokenInternal(address(lpToken), fromUser, address(tokenService), lpAmount);
        // burn old amount of LP
        burnToken(lpAmount, address(lpToken));
        return HederaResponseCodes.SUCCESS;
    }

    function createFungibleTokenPublic(int mintingAmount) internal returns (int responseCode, address tokenAddress) {
        uint256 supplyKeyType;
        IHederaTokenService.KeyValue memory supplyKeyValue;

        supplyKeyType = supplyKeyType.setBit(4);
        supplyKeyValue.delegatableContractId = address(tokenService);

        IHederaTokenService.TokenKey[]
            memory keys = new IHederaTokenService.TokenKey[](1);
        keys[0] = IHederaTokenService.TokenKey(supplyKeyType, supplyKeyValue);

        IHederaTokenService.Expiry memory expiry;
        expiry.autoRenewAccount = address(tokenService);
        expiry.autoRenewPeriod = 8000000;

        IHederaTokenService.HederaToken memory myToken;
        myToken.name = "Lab49";
        myToken.symbol = "L49";
        myToken.treasury = address(tokenService);
        myToken.expiry = expiry;
        myToken.tokenKeys = keys;

        (responseCode,  tokenAddress) = createFungibleTokenInternal(myToken, uint(mintingAmount), 8);
    
        require(responseCode == HederaResponseCodes.SUCCESS, "Token creation failed");
    }

    function sqrt(int value) public pure returns (int output) {
        int modifiedValue = (value + 1) / 2;
        output = value;
        while (modifiedValue < output) {
            output = modifiedValue;
            modifiedValue = (value / modifiedValue + modifiedValue) / 2;    
        }
    }
}

library Bits {

    uint constant internal ONE = uint(1);

    // Sets the bit at the given 'index' in 'self' to '1'.
    // Returns the modified value.
    function setBit(uint self, uint8 index) internal pure returns (uint) {
        return self | ONE << index;
    }
}