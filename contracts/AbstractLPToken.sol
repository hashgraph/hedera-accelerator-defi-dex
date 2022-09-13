//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./common/hedera/HederaResponseCodes.sol";
import "./common/IBaseHTS.sol";
import "./common/hedera/IHederaTokenService.sol";
import "./common/hedera/HederaTokenService.sol";
import "./common/hedera/ExpiryHelper.sol";

abstract contract AbstractLPToken is HederaTokenService {
    IBaseHTS tokenService;
    mapping (address => uint256) tokenShare;   
    address internal creator;
    address internal lpToken;
    bytes internal supplyKey;

    function lpTokenForUser(address _user) public view returns(uint256) {
        return tokenShare[_user];
    }

    function mintToken(uint64 amount) internal virtual returns (int responseCode, uint64 newTotalSupply, int64[] memory serialNumbers);    
    function associateTokenInternal(address account,  address _token) internal virtual returns(int);
    function transferTokenInternal(address _token, address sender, address receiver, int64 amount) internal virtual returns(int);


    function initializeParams(address _lpToken, IBaseHTS _tokenService) external {
         lpToken = _lpToken;
         tokenService = _tokenService;
    }
     
    function allotLPTokenFor(uint64 amountA, uint64 amountB, address _toUser) external returns (int responseCode) {
        require(lpToken > address(0x0), "Liquidity Token not initialized");
        require((amountA > 0 && amountB > 0), "Please provide positive token counts" );
        uint64 mintingAmount = sqrt(amountA * amountB);
        associateTokenInternal(_toUser, lpToken);
        mintToken(mintingAmount);
        tokenShare[_toUser] = tokenShare[_toUser] + mintingAmount;
        transferTokenInternal(lpToken, address(tokenService), _toUser, int64(mintingAmount));
        return HederaResponseCodes.SUCCESS;
    }

    function sqrt(uint64 x) public pure returns (uint64 y) {
        uint64 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}