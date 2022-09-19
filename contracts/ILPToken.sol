//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface ILPToken { 
    function allotLPTokenFor(int amountA, int amountB, address _toUser) external returns (int responseCode);
    function removeLPTokenFor(int lpAmount, address _toUser) external returns (int responseCode);
    function lpTokenForUser(address _user) external view returns(int);
    function getAllLPTokenCount() external view returns(int);
}