//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./common/hedera/HederaResponseCodes.sol";
import "./common/IBaseHTS.sol";
import "./common/hedera/HederaTokenService.sol";

abstract contract AbstractLPToken is HederaTokenService {
    IBaseHTS tokenService;
    mapping (address => uint256) tokenShare;   
    address internal creator;
    address internal lpToken;

    function lpTokenForUser(address _user) public view returns(uint256) {
        return tokenShare[_user];
    }

    function mintToken(uint64 amount) internal virtual returns (int responseCode, uint64 newTotalSupply);    
    function associateTokenInternal(address account,  address _token) internal virtual returns(int);
    function transferTokenInternal(address _token, address sender, address receiver, int64 amount) internal virtual returns(int);
    function burnToken(uint64 amount) internal virtual returns (int); 

    function initializeParams(address _lpToken, IBaseHTS _tokenService) external {
         lpToken = _lpToken;
         tokenService = _tokenService;
    }
     
    function allotLPTokenFor(uint64 amountA, uint64 amountB, address _toUser) external returns (int responseCode) {
        require(lpToken > address(0x0), "Liquidity Token not initialized");
        require((amountA > 0 && amountB > 0), "Please provide positive token counts" );
        // uint64 mintingAmount = sqrt(10);
        uint aM = uint(amountA);
        uint bM = uint(amountB);
        uint A = aM * bM;
        uint mintingAmount = sqrt(A);
        uint64 convertedMintingAmount = convert(mintingAmount);
        associateTokenInternal(_toUser, lpToken);
        mintToken(convertedMintingAmount);
        tokenShare[_toUser] = tokenShare[_toUser] + convertedMintingAmount;
        transferTokenInternal(lpToken, address(tokenService), _toUser, int64(convertedMintingAmount));
        return HederaResponseCodes.SUCCESS;
    }

    function removeLPTokenFor(uint64 lpAmount, address _toUser) external returns (int responseCode) {
        require(lpToken > address(0x0), "Liquidity Token not initialized");
        require((lpAmount > 0), "Please provide token counts" );
        // transfer Lp from users account to contract
        transferTokenInternal(lpToken, _toUser, address(tokenService), int64(lpAmount));
        // burn old amount of LP
        burnToken(lpAmount);
        tokenShare[_toUser] = tokenShare[_toUser] - lpAmount;
        return HederaResponseCodes.SUCCESS;
    }

    function sqrt(uint x) public pure returns (uint y) {
        uint z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function convert (uint256 _a) internal pure returns (uint64) {
        return uint64(_a);
    }

}