//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./common/hedera/HederaTokenService.sol";
import "./common/hedera/HederaResponseCodes.sol";

interface ILPToken { 
    function allotLPTokenFor(uint64 amountA, uint64 amountB) external returns (int responseCode);

    function burnToken(uint64 amount, int64[] memory serialNumbers) external
        returns (int responseCode, uint64 newTotalSupply);
}