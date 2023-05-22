// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "../common/IBaseHTS.sol";

interface IVault {
    function initialize(
        IBaseHTS _baseHTS,
        address _stakingToken,
        uint256 _lockingPeriod
    ) external;

    function addReward(address _token, uint256 _amount, address _from) external;

    function stake(uint256 _amount) external;

    function unstake(uint256 _amount) external;

    function getStakingTokenTotalSupply() external view returns (uint256);

    function getStakingTokenAddress() external view returns (address);

    function getLockingPeriod() external view returns (uint256);

    function stakedTokenByUser(address _user) external view returns (uint256);

    function claimAllRewards(address _user) external;

    function canUserUnstakeTokens(
        address _user,
        uint256 _amount
    ) external view returns (bool);

    function claimSpecificRewards(
        address _user,
        address[] memory _rewardTokens
    ) external;
}
