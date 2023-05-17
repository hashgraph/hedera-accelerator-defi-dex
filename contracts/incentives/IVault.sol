// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "../common/IBaseHTS.sol";

interface IVault {
    function initialize(
        IBaseHTS _baseHTS,
        address _stakingToken,
        uint256 _lockingPeriod
    ) external;

    function addReward(
        address _token,
        uint256 _amount,
        address _fromAccount
    ) external;

    function deposit(uint256 _amount) external;

    function withdraw(uint256 _amount) external;

    function getTotalVolume() external view returns (uint256);

    function getLockingPeriod() external view returns (uint256);

    function getUserContribution(address _user) external view returns (uint256);

    function claimAllRewards(address _user) external;

    function claimSpecificRewards(
        address _user,
        address[] memory _rewardTokens
    ) external;
}
