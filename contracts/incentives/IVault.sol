// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "../common/IHederaService.sol";
import "../common/ISystemRoleBasedAccess.sol";

interface IVault {
    struct ClaimCallResponse {
        uint256 alreadyClaimedCount;
        uint256 claimedRewardsCount;
        uint256 unclaimedRewardsCount;
        uint256 totalRewardsCount;
        address[] claimedRewardsTokens;
    }

    function initialize(
        IHederaService _hederaService,
        address _stakingToken,
        uint256 _lockingPeriod,
        ISystemRoleBasedAccess _iSystemRoleBasedAccess
    ) external;

    function addReward(address _token, uint256 _amount, address _from) external;

    function stake(uint256 _amount) external returns (bool);

    function unstake(uint256 _amount) external returns (bool);

    function getStakingTokenTotalSupply() external view returns (uint256);

    function getStakingTokenAddress() external view returns (address);

    function getStakingTokenLockingPeriod() external view returns (uint256);

    function stakedTokenByUser(address _user) external view returns (uint256);

    function canUserUnStakeTokens(
        address _user,
        uint256 _amount
    ) external view returns (bool);

    function canUserClaimRewards(address _user) external returns (bool);

    function claimRewards(
        address _user
    ) external returns (ClaimCallResponse memory response);
}
