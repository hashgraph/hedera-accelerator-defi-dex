// SPDX-License-Identifier: MIT

pragma solidity ^0.8;

interface IVault {

    function addToken(address _token, uint _amount) external;
    function getTotalVolume() external view returns(uint);
    function getLockPeriod() external view returns(uint);
}