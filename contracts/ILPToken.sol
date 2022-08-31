//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./common/hedera/HederaTokenService.sol";
import "./common/hedera/HederaResponseCodes.sol";

interface ILPToken { 
    function allotLPTokenFor(uint64 amountA, uint64 amountB, address _toUser) external returns (int responseCode);
    function initializeParams(string memory _name, string memory _symbol ) external;
    function getName() external view returns (string memory);
    function burnToken(uint64 amount, int64[] memory serialNumbers) external
        returns (int responseCode, uint64 newTotalSupply);
}