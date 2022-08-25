//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./common/hedera/HederaResponseCodes.sol";
import "./common/IBaseHTS.sol";
import "./AbstractLPToken.sol";

contract LPToken is AbstractLPToken {

    constructor(IBaseHTS _tokenService, address _lpToken) {
        tokenService = _tokenService;
        lpToken = _lpToken;
        creator = msg.sender;
    }

     function mintToken(uint64 amount) override internal virtual 
     returns (int responseCode, uint64 newTotalSupply, int64[] memory serialNumbers) {
            (bool success, bytes memory result) = address(tokenService).delegatecall(
            abi.encodeWithSelector(IBaseHTS.mintTokenPublic.selector,
            lpToken, amount));
            int64[] memory blank;
            if (success) {
                tokenShare[msg.sender] = tokenShare[msg.sender] + amount;
            }
            return success ? abi.decode(result, (int, uint64, int64[])) : (HederaResponseCodes.UNKNOWN, 0, blank);
    }

    function burnToken(uint64 amount, int64[] memory serialNumbers) internal override virtual
        returns (int responseCode, uint64 newTotalSupply) {
            (bool success, bytes memory result) = address(tokenService).delegatecall(
            abi.encodeWithSelector(IBaseHTS.burnTokenPublic.selector,
            lpToken, amount, serialNumbers));
            if (success) {
                tokenShare[msg.sender] = tokenShare[msg.sender] - amount;
            }
        return success ? abi.decode(result, (int, uint64)) : (HederaResponseCodes.UNKNOWN, 0);
    }

    function associateToken(address account,  address _token) internal override  virtual returns(int) {
        (bool success, bytes memory result) = address(tokenService).delegatecall(
            abi.encodeWithSelector(IBaseHTS.associateTokenPublic.selector,
            account, _token));
        return success ? abi.decode(result, (int32)) : HederaResponseCodes.UNKNOWN;
    }

    function transferToken(address _token, address sender, address receiver, int64 amount) internal override virtual returns(int) {
        (bool success, bytes memory result) = address(tokenService).delegatecall(
            abi.encodeWithSelector(IBaseHTS.transferTokenPublic.selector,
            _token, sender, receiver, amount));
        return success ? abi.decode(result, (int32)) : HederaResponseCodes.UNKNOWN;
    }
}
