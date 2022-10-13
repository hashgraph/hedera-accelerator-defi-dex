//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./common/IBaseHTS.sol";

interface ILPToken { 
    function initializeParams(IBaseHTS _tokenService) external payable;
    function allotLPTokenFor(int amountA, int amountB, address _toUser) external returns (int responseCode);
    function removeLPTokenFor(int lpAmount, address fromUser) external returns (int responseCode);
    function lpTokenForUser(address _user) external view returns(int);
    function getAllLPTokenCount() external view returns(int);
}