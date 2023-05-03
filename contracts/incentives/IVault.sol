// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IVault {
    function addReward(
        address _token,
        uint256 _amount,
        address _fromAccount
    ) external;

    function addStake(uint256 _amount) external returns (uint256 timeStamp);

    function getTotalVolume() external view returns (uint);

    function getLockPeriod() external view returns (uint);
}
