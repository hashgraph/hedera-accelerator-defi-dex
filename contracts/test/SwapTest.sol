// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "../common/hedera/HederaResponseCodes.sol";
import "../common/IBaseHTS.sol";
import "../AbstractSwap.sol";

contract SwapTest is AbstractSwap {

    constructor(IBaseHTS _tokenService) {
        tokenService = _tokenService;
        creator = msg.sender;
    }

    function associateToken(address,  address ) internal override  virtual returns(int) {
        return HederaResponseCodes.SUCCESS;
    }

    function transferToken(address, address , address, int64) internal override virtual returns(int) {
        return HederaResponseCodes.SUCCESS;
    }
}
