//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface ILPToken { 
    function allotLPTokenFor(uint64 amountA, uint64 amountB, address _toUser) external returns (int responseCode);
    function removeLPTokenFor(uint64 lpAmount, address _toUser) external returns (int responseCode);
    function initializeParams(string memory _name, string memory _symbol ) external;
}