//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./common/hedera/HederaResponseCodes.sol";
import "./common/IBaseHTS.sol";
import "./common/hedera/IHederaTokenService.sol";
import "./common/hedera/HederaTokenService.sol";
import "./common/hedera/ExpiryHelper.sol";

abstract contract HederaToken {
    function name() public virtual view returns(string memory);
}

abstract contract AbstractLPToken is HederaTokenService {
    IBaseHTS tokenService;
    mapping (address => uint256) tokenShare;   
    address internal creator;
    address internal lpToken;
    bytes internal supplyKey;

    function lpTokenForUser(address _user) internal view returns(uint256) {
        return tokenShare[_user];
    }

    // Abstract Functions
    function mintToken(uint64 amount) internal virtual returns (int responseCode, uint64 newTotalSupply, int64[] memory serialNumbers);    
    function associateTokenInternal(address account,  address _token) internal virtual returns(int);
    function transferTokenInternal(address _token, address sender, address receiver, int64 amount) internal virtual returns(int);


    function initializeParams(address _lpToken, IBaseHTS _tokenService) external {
         // instantiate the list of keys we'll use for token create
         lpToken = _lpToken;
         tokenService = _tokenService;
    }
     
    function allotLPTokenFor(uint64 amountA, uint64 amountB, address _toUser) external returns (int responseCode) {
        require(lpToken > address(0x0), "Liquidity Token not initialized");
        require((amountA > 0 && amountB > 0), "Please provide positive token counts" );
        // logic to decide quantity of LP
        uint64 mintingAmount = sqrt(amountA * amountB);
        //Associate LP to user
        associateTokenInternal(_toUser, lpToken);
        ////mint new amount of LP
        mintToken(mintingAmount);
        // transfer Lp to users account
        transferTokenInternal(lpToken, address(tokenService), _toUser, int64(mintingAmount));
        return 22;
    }

    function sqrt(uint64 x) internal pure returns (uint64 y) {
        uint64 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}