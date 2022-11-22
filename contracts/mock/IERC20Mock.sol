//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IERC20Mock {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function setTotal(uint256 _total) external ;
    function setUserBalance(address _user,uint256 _userBalance) external;
}