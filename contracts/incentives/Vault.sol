//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./IVault.sol";
import "../common/IERC20.sol";
import "../common/IErrors.sol";
import "../common/TokenOperations.sol";
import "../common/hedera/HederaResponseCodes.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Vault is IVault, OwnableUpgradeable, TokenOperations {
    using PRBMathUD60x18 for uint256;

    struct UserStakingTokenContribution {
        bool alreadyStaked;
        uint256 stakingTokenTotal;
        uint256 lastLockedTime;
        mapping(address => uint256) rewardClaimed;
    }

    struct RewardInfo {
        bool exist;
        uint256 perShareAmount;
    }

    IBaseHTS private baseHTS;

    IERC20 private stakingToken;
    uint256 private stakingTokenTotalSupply;
    uint256 private stakingTokenLockingPeriod;

    mapping(address => UserStakingTokenContribution)
        public usersStakingTokenContribution;

    address[] private rewardTokens;
    mapping(address => RewardInfo) public tokensRewardInfo;

    function initialize(
        IBaseHTS _baseHTS,
        address _stakingToken,
        uint256 _lockingPeriod
    ) public initializer {
        __Ownable_init();
        require(
            _stakingToken != address(0),
            "Vault: staking token should not be zero"
        );
        require(
            _lockingPeriod > 0,
            "Vault: locking period should be a positive number"
        );
        baseHTS = _baseHTS;
        stakingTokenLockingPeriod = _lockingPeriod;
        stakingToken = IERC20(_stakingToken);
        _associateToken(_baseHTS, address(this), _stakingToken);
    }

    function stake(uint256 _amount) external override {
        require(_amount > 0, "Vault: stake amount must be a positive number");
        if (usersStakingTokenContribution[msg.sender].alreadyStaked) {
            claimAllRewards(msg.sender);
        } else {
            _setUpStaker(msg.sender);
        }
        _stake(msg.sender, _amount);
    }

    function unstake(uint256 _amount) external override {
        require(_amount > 0, "Vault: unstake amount must be a positive number");
        require(
            canUserUnstakeTokens(msg.sender, _amount),
            "Vault: unstake not allowed"
        );
        claimAllRewards(msg.sender);
        _unstake(msg.sender, _amount);
    }

    function addReward(
        address _token,
        uint256 _amount,
        address _from
    ) external override {
        require(_token != address(0), "Vault: reward token should not be zero");
        require(_from != address(0), "Vault: from address should not be zero");
        require(_amount > 0, "Vault: reward amount must be a positive number");
        require(stakingTokenTotalSupply > 0, "Vault: no token staked yet");
        uint256 perShareAmount = _amount.div(stakingTokenTotalSupply);
        RewardInfo storage rewardInfo = tokensRewardInfo[_token];
        if (!rewardInfo.exist) {
            rewardInfo.exist = true;
            rewardTokens.push(_token);
            _associateToken(baseHTS, address(this), _token);
        }
        rewardInfo.perShareAmount += perShareAmount;
        require(
            _transferToken(_token, _from, address(this), _amount) ==
                HederaResponseCodes.SUCCESS,
            "Vault: Add reward failed"
        );
    }

    function canUserUnstakeTokens(
        address _user,
        uint256 _amount
    ) public view override returns (bool) {
        UserStakingTokenContribution
            storage cInfo = usersStakingTokenContribution[_user];
        return
            cInfo.alreadyStaked &&
            cInfo.stakingTokenTotal > 0 &&
            cInfo.stakingTokenTotal >= _amount &&
            block.timestamp >
            (cInfo.lastLockedTime + stakingTokenLockingPeriod);
    }

    function stakedTokenByUser(
        address _user
    ) external view override returns (uint256) {
        return usersStakingTokenContribution[_user].stakingTokenTotal;
    }

    function getStakingTokenTotalSupply()
        external
        view
        override
        returns (uint256)
    {
        return stakingTokenTotalSupply;
    }

    function getLockingPeriod() external view override returns (uint256) {
        return stakingTokenLockingPeriod;
    }

    function getStakingTokenAddress() external view override returns (address) {
        return address(stakingToken);
    }

    function claimAllRewards(address _user) public override {
        this.claimSpecificRewards(_user, rewardTokens);
    }

    function claimSpecificRewards(
        address _user,
        address[] memory _rewardTokens
    ) public override {
        for (uint256 i = 0; i < _rewardTokens.length; i++) {
            address rewardToken = _rewardTokens[i];
            RewardInfo memory rewardInfo = tokensRewardInfo[rewardToken];
            if (rewardInfo.exist) {
                _claimReward(_user, rewardToken, rewardInfo);
            } else {
                revert("Vault: invalid token");
            }
        }
    }

    function _claimReward(
        address _user,
        address _rewardToken,
        RewardInfo memory _rewardInfo
    ) private {
        uint256 perShareRewardAmt = _rewardInfo.perShareAmount;
        UserStakingTokenContribution
            storage cInfo = usersStakingTokenContribution[_user];
        uint256 totalShares = cInfo.stakingTokenTotal;
        uint256 perShareClaimedAmt = cInfo.rewardClaimed[_rewardToken];
        uint256 perShareUnclaimedAmt = perShareRewardAmt - perShareClaimedAmt;
        uint256 unclaimedRewards = totalShares.mul(perShareUnclaimedAmt);
        cInfo.rewardClaimed[_rewardToken] = perShareRewardAmt;
        if (unclaimedRewards > 0) {
            require(
                _transferToken(
                    _rewardToken,
                    address(this),
                    _user,
                    unclaimedRewards
                ) == HederaResponseCodes.SUCCESS,
                "Vault: Claim reward failed"
            );
        }
    }

    function _stake(address _user, uint256 _amount) private {
        UserStakingTokenContribution
            storage cInfo = usersStakingTokenContribution[_user];
        cInfo.alreadyStaked = true;
        cInfo.lastLockedTime = block.timestamp;
        cInfo.stakingTokenTotal += _amount;
        stakingTokenTotalSupply += _amount;
        require(
            _transferToken(
                address(stakingToken),
                _user,
                address(this),
                _amount
            ) == HederaResponseCodes.SUCCESS,
            "Vault: Add stake failed"
        );
    }

    function _unstake(address _user, uint256 _amount) private {
        UserStakingTokenContribution
            storage cInfo = usersStakingTokenContribution[_user];
        cInfo.stakingTokenTotal -= _amount;
        stakingTokenTotalSupply -= _amount;
        require(
            _transferToken(
                address(stakingToken),
                address(this),
                _user,
                _amount
            ) == HederaResponseCodes.SUCCESS,
            "Vault: unstake failed"
        );
    }

    function _setUpStaker(address _user) private {
        UserStakingTokenContribution
            storage cInfo = usersStakingTokenContribution[_user];
        uint256 rewardTokensCount = rewardTokens.length;
        for (uint256 counter = 0; counter < rewardTokensCount; counter++) {
            address rewardToken = rewardTokens[counter];
            cInfo.rewardClaimed[rewardToken] = tokensRewardInfo[rewardToken]
                .perShareAmount;
        }
    }
}
