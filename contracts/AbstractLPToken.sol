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
    IERC20 internal lpToken;

    function lpTokenForUser(address _user) external view override returns(int) {
        return int(lpToken.balanceOf(_user));
    }

    function getAllLPTokenCount() external view override returns(int) {
        return int(lpToken.totalSupply());
    }

    function mintToken(int amount) internal virtual returns (int responseCode, int newTotalSupply);    
    function associateTokenInternal(address account,  address _token) internal virtual returns(int);
    function transferTokenInternal(address _token, address sender, address receiver, int amount) internal virtual returns(int);
    function burnToken(int amount) internal virtual returns (int); 

    function initializeParams(IERC20 _lpToken, IBaseHTS _tokenService) external {
         lpToken = _lpToken;
         tokenService = _tokenService;
    }
     
    function allotLPTokenFor(int amountA, int amountB, address _toUser) external override returns (int responseCode) {
        require(address(lpToken) > address(0x0), "Liquidity Token not initialized");
        require((amountA > 0 && amountB > 0), "Please provide positive token counts" );
        int mintingAmount = sqrt(amountB * amountB);
        associateTokenInternal(_toUser, address(lpToken));
        mintToken(mintingAmount);
        transferTokenInternal(address(lpToken), address(tokenService), _toUser, mintingAmount);
        return HederaResponseCodes.SUCCESS;
    }

    function removeLPTokenFor(int lpAmount, address _toUser) external override returns (int responseCode) {
        require(address(lpToken) > address(0x0), "Liquidity Token not initialized");
        require((lpAmount > 0), "Please provide token counts" );
        require(this.lpTokenForUser(_toUser) > lpAmount, "User Does not have lp amount" );
        // transfer Lp from users account to contract
        transferTokenInternal(address(lpToken), _toUser, address(tokenService), lpAmount);
        // burn old amount of LP
        burnToken(lpAmount);
        return HederaResponseCodes.SUCCESS;
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