//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./common/hedera/HederaTokenService.sol";
import "./common/hedera/HederaResponseCodes.sol";

interface ILPToken { 
    function mintToken(address token, uint64 amount, bytes[] memory metadata) external
        returns (int responseCode, uint64 newTotalSupply, int64[] memory serialNumbers);

    function burnToken(address token, uint64 amount, int64[] memory serialNumbers) external
        returns (int responseCode, uint64 newTotalSupply);
}