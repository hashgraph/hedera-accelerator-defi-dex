//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "./common/hedera/HederaResponseCodes.sol";
import "./common/IBaseHTS.sol";

abstract contract AbstractLPToken is HederaResponseCodes {
    IBaseHTS tokenService;
    mapping (address => uint256) tokenShare;   
    address internal creator;
    address internal lpToken;

    function lpTokenForUser(address _user) internal view returns(uint256) {
        return tokenShare[_user];
    }

    // Abstract Functions
    function mintToken(uint64 amount) internal virtual returns (int responseCode, uint64 newTotalSupply, int64[] memory serialNumbers);

    function burnToken(uint64 amount, int64[] memory serialNumbers) internal virtual returns (int responseCode, uint64 newTotalSupply);
    
    function associateToken(address account,  address _token) internal virtual returns(int);

    function transferToken(address _token, address sender, address receiver, int64 amount) internal virtual returns(int);


    function allotLPTokenFor(uint64 amountA, uint64 amountB) external returns (int responseCode) {
        require((amountA > 0 && amountB > 0), "Please provide positive token counts" );
        // logic to decide quantity of LP
        uint64 mintingAmount = sqrt(amountA * amountB);
        // Associate LP to user
        associateToken(msg.sender, lpToken);
        // mint new amount of LP
        mintToken(mintingAmount);
        // transfer Lp to users account

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