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
        return tokenService.associateTokenPublic(account, _token);
    }

    function transferToken(address _token, address sender, address receiver, int amount) internal override virtual returns(int) {
        return tokenService.transferTokenPublic(_token, sender, receiver, amount);
    }
}
