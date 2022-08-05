<<<<<<< HEAD
//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
=======
// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;
>>>>>>> 051fb57 (Proxy contract deployment using GitHUB action)
pragma experimental ABIEncoderV2;

import "./common/hedera/HederaResponseCodes.sol";
import "./common/IBaseHTS.sol";
import "./AbstractSwap.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
<<<<<<< HEAD
import "./ILPToken.sol";


contract Swap is AbstractSwap, Initializable {

    function initialize(IBaseHTS _tokenService, ILPToken _lpTokenContract) public initializer {
        tokenService = _tokenService;
        creator = msg.sender;
        lpTokenContract = _lpTokenContract;
=======

contract Swap is AbstractSwap, Initializable {

    function initialize(IBaseHTS _tokenService) public initializer {
        tokenService = _tokenService;
        creator = msg.sender;
>>>>>>> 051fb57 (Proxy contract deployment using GitHUB action)
    }

    function associateToken(address account,  address _token) internal override  virtual returns(int) {
        (bool success, bytes memory result) = address(tokenService).delegatecall(
            abi.encodeWithSelector(IBaseHTS.associateTokenPublic.selector,
            account, _token));
        return success ? abi.decode(result, (int32)) : HederaResponseCodes.UNKNOWN;
    }

<<<<<<< HEAD
    function transferToken(address _token, address sender, address receiver, int amount) internal override virtual returns(int) {
=======
    function transferToken(address _token, address sender, address receiver, int64 amount) internal override virtual returns(int) {
>>>>>>> 051fb57 (Proxy contract deployment using GitHUB action)
        (bool success, bytes memory result) = address(tokenService).delegatecall(
            abi.encodeWithSelector(IBaseHTS.transferTokenPublic.selector,
            _token, sender, receiver, amount));
        return success ? abi.decode(result, (int32)) : HederaResponseCodes.UNKNOWN;
    }
}
