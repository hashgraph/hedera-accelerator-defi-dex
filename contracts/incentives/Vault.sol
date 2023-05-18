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

    struct ContributionInfo {
        bool exist;
        uint256 total;
        uint256 lastLockedTime;
        mapping(address => uint256) claimed;
    }

    struct RewardInfo {
        bool exist;
        uint256 perShareAmount;
    }

    IBaseHTS private baseHTS;
    IERC20 private stakingToken;

    uint256 private totalSupply;
    uint256 private lockingPeriod;

    mapping(address => ContributionInfo) public usersContributionInfo;

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
        lockingPeriod = _lockingPeriod;
        stakingToken = IERC20(_stakingToken);
        _associateToken(_baseHTS, address(this), _stakingToken);
    }

    function deposit(uint256 _amount) external override {
        require(_amount > 0, "Vault: deposit amount must be a positive number");
        if (usersContributionInfo[msg.sender].exist) {
            claimAllRewards(msg.sender);
        } else {
            _setUpStaker(msg.sender);
        }
        _deposit(msg.sender, _amount);
    }

    function withdraw(uint256 _amount) external override {
        require(
            _amount > 0,
            "Vault: withdraw amount must be a positive number"
        );
        require(
            canUserWithdrawTokens(msg.sender, _amount),
            "Vault: withdraw not allowed"
        );
        claimAllRewards(msg.sender);
        _withdraw(msg.sender, _amount);
    }

    function addReward(
        address _token,
        uint256 _amount,
        address _from
    ) external override {
        require(_token != address(0), "Vault: reward token should not be zero");
        require(_from != address(0), "Vault: from address should not be zero");
        require(_amount > 0, "Vault: reward amount must be a positive number");
        require(totalSupply > 0, "Vault: no token staked yet");
        uint256 perShareAmount = _amount.div(totalSupply);
        RewardInfo storage rewardInfo = tokensRewardInfo[_token];
        if (!rewardInfo.exist) {
            rewardInfo.exist = true;
            rewardTokens.push(_token);
            _associateToken(baseHTS, address(this), _token);
        }
        rewardInfo.perShareAmount += perShareAmount;
        require(
            _transferToken(_token, _from, address(this), int256(_amount)) ==
                HederaResponseCodes.SUCCESS,
            "Vault: Add reward failed"
        );
    }

    function canUserWithdrawTokens(
        address _user,
        uint256 _amount
    ) public view override returns (bool) {
        ContributionInfo storage cInfo = usersContributionInfo[_user];
        require(cInfo.exist, "Vault: no contribution yet");
        return
            _amount <= cInfo.total &&
            block.timestamp > (cInfo.lastLockedTime + lockingPeriod);
    }

    function getUserContribution(
        address _user
    ) external view override returns (uint256) {
        return usersContributionInfo[_user].total;
    }

    function getTotalVolume() external view override returns (uint256) {
        return totalSupply;
    }

    function getLockingPeriod() external view override returns (uint256) {
        return lockingPeriod;
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
        ContributionInfo storage cInfo = usersContributionInfo[_user];
        uint256 totalShares = cInfo.total;
        uint256 perShareClaimedAmt = cInfo.claimed[_rewardToken];
        uint256 perShareUnclaimedAmt = perShareRewardAmt - perShareClaimedAmt;
        uint256 unclaimedRewards = totalShares.mul(perShareUnclaimedAmt);
        cInfo.claimed[_rewardToken] = perShareRewardAmt;
        if (unclaimedRewards > 0) {
            require(
                _transferToken(
                    _rewardToken,
                    address(this),
                    _user,
                    int256(unclaimedRewards)
                ) == HederaResponseCodes.SUCCESS,
                "Vault: Claim reward failed"
            );
        }
    }

    function _deposit(address _user, uint256 _amount) private {
        ContributionInfo storage cInfo = usersContributionInfo[_user];
        cInfo.exist = true;
        cInfo.lastLockedTime = block.timestamp;
        cInfo.total += _amount;
        totalSupply += _amount;
        require(
            _transferToken(
                address(stakingToken),
                _user,
                address(this),
                int256(_amount)
            ) == HederaResponseCodes.SUCCESS,
            "Vault: Add stake failed"
        );
    }

    function _withdraw(address _user, uint256 _amount) private {
        ContributionInfo storage cInfo = usersContributionInfo[_user];
        cInfo.total -= _amount;
        totalSupply -= _amount;
        require(
            _transferToken(
                address(stakingToken),
                address(this),
                _user,
                int256(_amount)
            ) == HederaResponseCodes.SUCCESS,
            "Vault: withdraw failed"
        );
    }

    // todo: need to check this
    function _setUpStaker(address _user) private {
        ContributionInfo storage cInfo = usersContributionInfo[_user];
        uint256 rewardTokensCount = rewardTokens.length;
        for (uint256 counter = 0; counter < rewardTokensCount; counter++) {
            address rewardToken = rewardTokens[counter];
            cInfo.claimed[rewardToken] = tokensRewardInfo[rewardToken]
                .perShareAmount;
        }
    }
}
