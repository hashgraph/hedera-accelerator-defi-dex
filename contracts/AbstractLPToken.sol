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

    function mintToken(address token, uint64 amount, bytes[] memory metadata) internal virtual
        returns (int responseCode, uint64 newTotalSupply, int64[] memory serialNumbers);

    function burnToken(address token, uint64 amount, int64[] memory serialNumbers) internal virtual
        returns (int responseCode, uint64 newTotalSupply);

}