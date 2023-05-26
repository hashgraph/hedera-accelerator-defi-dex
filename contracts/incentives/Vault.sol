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

    uint256 private constant MAX_REWARDS_PER_TXN = 40;
    IHederaService private hederaService;

    IERC20 private stakingToken;
    uint256 private stakingTokenTotalSupply;
    uint256 private stakingTokenLockingPeriod;

    mapping(address => UserStakingTokenContribution)
        public usersStakingTokenContribution;

    address[] private rewardTokens;
    mapping(address => RewardInfo) public tokensRewardInfo;

    function initialize(
        IHederaService _hederaService,
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
        hederaService = _hederaService;
        stakingTokenLockingPeriod = _lockingPeriod;
        stakingToken = IERC20(_stakingToken);
        _associateToken(_hederaService, address(this), _stakingToken);
    }

    function stake(uint256 _amount) external override {
        require(_amount > 0, "Vault: stake amount must be a positive number");
        require(
            !canUserClaimRewards(msg.sender),
            "Vault: rewards should be claimed before stake"
        );
        if (!usersStakingTokenContribution[msg.sender].alreadyStaked) {
            _setUpStaker(msg.sender);
        }
        _stake(msg.sender, _amount);
    }

    function unstake(uint256 _amount) external override {
        require(_amount > 0, "Vault: unstake amount must be a positive number");
        require(
            canUserUnStakeTokens(msg.sender, _amount),
            "Vault: unstake not allowed"
        );
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
            _associateToken(hederaService, address(this), _token);
        }
        rewardInfo.perShareAmount += perShareAmount;
        require(
            _transferToken(_token, _from, address(this), _amount) ==
                HederaResponseCodes.SUCCESS,
            "Vault: Add reward failed"
        );
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

    function getStakingTokenLockingPeriod()
        external
        view
        override
        returns (uint256)
    {
        return stakingTokenLockingPeriod;
    }

    function getStakingTokenAddress() external view override returns (address) {
        return address(stakingToken);
    }

    function canUserUnStakeTokens(
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
            (cInfo.lastLockedTime + stakingTokenLockingPeriod) &&
            !canUserClaimRewards(_user);
    }

    function canUserClaimRewards(
        address _user
    ) public view override returns (bool isClaimAvailable) {
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address rewardToken = rewardTokens[i];
            RewardInfo memory rewardInfo = tokensRewardInfo[rewardToken];
            (uint256 unclaimedRewardAmount, ) = _unclaimedRewardAmountDetails(
                _user,
                rewardToken,
                rewardInfo
            );
            if (unclaimedRewardAmount > 0) {
                isClaimAvailable = true;
                break;
            }
        }
    }

    function claimRewards(
        address _user
    ) public override returns (uint256 claimedRewardsCount) {
        require(
            canUserClaimRewards(_user),
            "Vault: no rewards available for user"
        );
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address rewardToken = rewardTokens[i];
            RewardInfo memory rewardInfo = tokensRewardInfo[rewardToken];
            (
                uint256 unclaimedRewardAmount,
                uint256 perShareRewardAmount
            ) = _unclaimedRewardAmountDetails(_user, rewardToken, rewardInfo);
            if (unclaimedRewardAmount > 0) {
                UserStakingTokenContribution
                    storage cInfo = usersStakingTokenContribution[_user];
                cInfo.rewardClaimed[rewardToken] = perShareRewardAmount;
                require(
                    _transferToken(
                        rewardToken,
                        address(this),
                        _user,
                        unclaimedRewardAmount
                    ) == HederaResponseCodes.SUCCESS,
                    "Vault: Claim reward failed"
                );
                if (++claimedRewardsCount >= MAX_REWARDS_PER_TXN) {
                    break;
                }
            }
        }
    }

    function upgradeHederaService(
        IHederaService newHederaService
    ) external onlyOwner {
        hederaService = newHederaService;
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
            "Vault: staking failed"
        );
    }

    function _unstake(address _user, uint256 _amount) private {
        UserStakingTokenContribution
            storage cInfo = usersStakingTokenContribution[_user];
        cInfo.stakingTokenTotal -= _amount;
        if (cInfo.stakingTokenTotal == 0) {
            delete usersStakingTokenContribution[_user];
        }
        stakingTokenTotalSupply -= _amount;
        require(
            _transferToken(
                address(stakingToken),
                address(this),
                _user,
                _amount
            ) == HederaResponseCodes.SUCCESS,
            "Vault: unstaking failed"
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

    function _unclaimedRewardAmountDetails(
        address _user,
        address _rewardToken,
        RewardInfo memory _rewardInfo
    ) private view returns (uint256 unclaimedAmount, uint256 perShareAmount) {
        perShareAmount = _rewardInfo.perShareAmount;
        UserStakingTokenContribution
            storage cInfo = usersStakingTokenContribution[_user];
        uint256 userStakingTokenTotal = cInfo.stakingTokenTotal;
        uint256 perShareClaimedAmount = cInfo.rewardClaimed[_rewardToken];
        uint256 perShareUnclaimedAmount = perShareAmount -
            perShareClaimedAmount;
        unclaimedAmount = userStakingTokenTotal.mul(perShareUnclaimedAmount);
    }
}
