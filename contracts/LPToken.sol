//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./common/hedera/HederaResponseCodes.sol";
import "./common/IBaseHTS.sol";
import "./AbstractLPToken.sol";

contract LPToken is AbstractLPToken {
    
    function mintToken(uint64 amount) override internal virtual 
     returns (int responseCode, uint64 newTotalSupply, int64[] memory serialNumbers) {
            (int response, uint64 _newTotalSupply, int64[] memory _serialNumbers) = tokenService.mintTokenPublic(lpToken, amount);

             if (response != HederaResponseCodes.SUCCESS) {
                revert ("Mint Failed");
             }
             tokenShare[msg.sender] = tokenShare[msg.sender] + amount;
            return (response, _newTotalSupply, _serialNumbers);
            // (bool success, bytes memory result) = address(tokenService).delegatecall(
            // abi.encodeWithSelector(IBaseHTS.mintTokenPublic.selector,
            // lpToken, amount));
            // int64[] memory blank;
            // if (success) {
            //     tokenShare[msg.sender] = tokenShare[msg.sender] + amount;
            // }
            // return success ? abi.decode(result, (int, uint64, int64[])) : (HederaResponseCodes.UNKNOWN, 0, blank);
    }

    function associateTokenInternal(address account,  address _token) internal override  virtual returns(int) {
        (bool success, bytes memory result) = address(tokenService).delegatecall(
            abi.encodeWithSelector(IBaseHTS.associateTokenPublic.selector,
            account, _token));
        return success ? abi.decode(result, (int32)) : HederaResponseCodes.UNKNOWN;
    }

    function transferTokenInternal(address _token, address sender, address receiver, int64 amount) internal override virtual returns(int) {
        return tokenService.transferTokenPublic(_token, sender, receiver, amount);
    }
}
