// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "./common/hedera/HederaResponseCodes.sol";
import "./common/IBaseHTS.sol";
import "./AbstractPair.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./ILPToken.sol";
import "./IPair.sol";


contract Pair is AbstractPair, Initializable {

    function initialize(IBaseHTS _tokenService, ILPToken _lpTokenContract) public override initializer {
        tokenService = _tokenService;
        creator = msg.sender;
        lpTokenContract = _lpTokenContract;
    }

    function associateToken(address account,  address _token) internal override  virtual returns(int) {
        (bool success, bytes memory result) = address(tokenService).delegatecall(
            abi.encodeWithSelector(IBaseHTS.associateTokenPublic.selector,
            account, _token));
        return success ? abi.decode(result, (int32)) : HederaResponseCodes.UNKNOWN;
    }

    function transferToken(address _token, address sender, address receiver, int amount) internal override virtual returns(int) {
        (bool success, bytes memory result) = address(tokenService).delegatecall(
            abi.encodeWithSelector(IBaseHTS.transferTokenPublic.selector,
            _token, sender, receiver, amount));
        return success ? abi.decode(result, (int32)) : HederaResponseCodes.UNKNOWN;
    }
}
