//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../common/hedera/HederaResponseCodes.sol";
import "../common/IBaseHTS.sol";
import "../common/IERC20.sol";
import "../AbstractLPToken.sol";

contract LPTokenTest is AbstractLPToken {
    
    constructor(IERC20 _lpToken, IBaseHTS _tokenService) {
         lpToken = _lpToken;
         tokenService = _tokenService;
    }

    function mintToken(int amount) override internal virtual 
     returns (int responseCode, int newTotalSupply) {
            (int response, int _newTotalSupply) = tokenService.mintTokenPublic(address(lpToken), amount);

             if (response != HederaResponseCodes.SUCCESS) {
                revert ("Mint Failed");
             }
            return (response, _newTotalSupply);
    }

    function burnToken(int amount) override internal virtual returns (int) {
        (int responseCode, ) = tokenService.burnTokenPublic(address(lpToken), amount);

        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert ("Burn Fail");
        }
        return responseCode;
    }

    function associateTokenInternal(address account,  address _token) internal override  virtual returns(int) {
        return tokenService.associateTokenPublic(account, _token);
    }

    function transferTokenInternal(address _token, address sender, address receiver, int amount) internal override virtual returns(int) {
        int responseCode = tokenService.transferTokenPublic(_token, sender, receiver, amount);
        if (responseCode != HederaResponseCodes.SUCCESS) {
                revert ("LP Token Transfer Fail");
        }
        return responseCode;
    }
}