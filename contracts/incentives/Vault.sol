//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./IVault.sol";
import "../common/IERC20.sol";
import "../common/IEvents.sol";
import "../common/IErrors.sol";
import "../common/TokenOperations.sol";
import "../common/hedera/HederaResponseCodes.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Vault is IEvents, IVault, OwnableUpgradeable, TokenOperations {
    using PRBMathUD60x18 for uint256;

    event Staked(address indexed user, uint256 amount);
    event UnStaked(address indexed user, uint256 amount);
    event RewardAdded(
        address indexed user,
        address indexed reward,
        uint256 amount
    );
    event ClaimRewardsCallResponse(
        address indexed user,
        ClaimCallResponse response
    );

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

    string private constant HederaService = "HederaService";
    uint256 private constant MAX_REWARDS_PER_TXN = 40;

    IHederaService private hederaService;

    IERC20 private stakingToken;
    uint256 private stakingTokenTotalSupply;
    uint256 private stakingTokenLockingPeriod;

    mapping(address => UserStakingTokenContribution)
        public usersStakingTokenContribution;

    address[] private rewardTokens;
    mapping(address => RewardInfo) public tokensRewardInfo;

    ISystemRoleBasedAccess private iSystemRoleBasedAccess;

    function initialize(
        IHederaService _hederaService,
        address _stakingToken,
        uint256 _lockingPeriod,
        ISystemRoleBasedAccess _iSystemRoleBasedAccess
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
        iSystemRoleBasedAccess = _iSystemRoleBasedAccess;
        _associateToken(_hederaService, address(this), _stakingToken);
        emit LogicUpdated(address(0), address(_hederaService), HederaService);
    }

    function stake(uint256 _amount) external override returns (bool staked) {
        require(_amount > 0, "Vault: stake amount must be a positive number");
        if (!usersStakingTokenContribution[msg.sender].alreadyStaked) {
            _setUpStaker(msg.sender);
            _stake(msg.sender, _amount);
            staked = true;
        } else if (
            claimRewardsInternally(msg.sender).unclaimedRewardsCount == 0
        ) {
            _stake(msg.sender, _amount);
            staked = true;
        }
    }

    function unstake(
        uint256 _amount
    ) external override returns (bool unstaked) {
        require(_amount > 0, "Vault: unstake amount must be a positive number");
        require(
            canUserUnStakeTokens(msg.sender, _amount),
            "Vault: unstake not allowed"
        );
        if (claimRewardsInternally(msg.sender).unclaimedRewardsCount == 0) {
            _unstake(msg.sender, _amount);
            unstaked = true;
        }
    }

    function addReward(
        address _token,
        uint256 _amount,
        address _from
    ) external override {
        iSystemRoleBasedAccess.checkVaultAddRewardUser(tx.origin);
        require(_token != address(0), "Vault: reward token should not be zero");
        require(_from != address(0), "Vault: from address should not be zero");
        require(_amount > 0, "Vault: reward amount must be a positive number");
        require(stakingTokenTotalSupply > 0, "Vault: no token staked yet");
        require(
            _token != address(stakingToken),
            "Vault: Reward and Staking tokens cannot be same."
        );
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
        emit RewardAdded(_from, _token, _amount);
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
            (cInfo.lastLockedTime + stakingTokenLockingPeriod);
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
    ) external override returns (ClaimCallResponse memory) {
        return claimRewardsInternally(_user);
    }

    function claimRewardsInternally(
        address _user
    ) private returns (ClaimCallResponse memory response) {
        response = _claimRewardsAndGetResponse(_user, MAX_REWARDS_PER_TXN);
        if (response.claimedRewardsCount > 0) {
            emit ClaimRewardsCallResponse(_user, response);
        }
        return response;
    }

    function _claimRewardsAndGetResponse(
        address _user,
        uint256 _maxRewardsTransferPerTxn
    ) private returns (ClaimCallResponse memory response) {
        response.claimedRewardsTokens = new address[](
            _maxRewardsTransferPerTxn
        );
        response.totalRewardsCount = rewardTokens.length;
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address rewardToken = rewardTokens[i];
            RewardInfo memory rewardInfo = tokensRewardInfo[rewardToken];
            (
                uint256 unclaimedAmount,
                uint256 perShareUnclaimedAmount
            ) = _unclaimedRewardAmountDetails(_user, rewardToken, rewardInfo);
            if (unclaimedAmount == 0) {
                response.alreadyClaimedCount++;
                continue;
            }
            if (response.claimedRewardsCount >= _maxRewardsTransferPerTxn) {
                response.unclaimedRewardsCount++;
                continue;
            }
            // rewards distributions start from here
            response.claimedRewardsTokens[
                response.claimedRewardsCount
            ] = rewardToken;
            response.claimedRewardsCount++;
            _transferAndUpdateRewardTokenHistoryForGivenUser(
                _user,
                rewardToken,
                unclaimedAmount,
                perShareUnclaimedAmount
            );
        }
    }

    function upgradeHederaService(
        IHederaService newHederaService
    ) external onlyOwner {
        emit LogicUpdated(
            address(hederaService),
            address(newHederaService),
            HederaService
        );
        hederaService = newHederaService;
    }

    function getHederaServiceVersion() external view returns (IHederaService) {
        return hederaService;
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
        emit Staked(_user, _amount);
    }

    function _unstake(address _user, uint256 _amount) private {
        UserStakingTokenContribution
            storage cInfo = usersStakingTokenContribution[_user];
        cInfo.stakingTokenTotal -= _amount;
        if (cInfo.stakingTokenTotal == 0) {
            for (uint256 i = 0; i < rewardTokens.length; i++) {
                delete cInfo.rewardClaimed[rewardTokens[i]];
            }
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
        emit UnStaked(_user, _amount);
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
    )
        private
        view
        returns (uint256 unclaimedAmount, uint256 perShareUnclaimedAmount)
    {
        uint256 perShareAmount = _rewardInfo.perShareAmount;
        UserStakingTokenContribution
            storage cInfo = usersStakingTokenContribution[_user];
        uint256 userStakingTokenTotal = cInfo.stakingTokenTotal;
        uint256 perShareClaimedAmount = cInfo.rewardClaimed[_rewardToken];
        perShareUnclaimedAmount = perShareAmount - perShareClaimedAmount;
        unclaimedAmount = userStakingTokenTotal.mul(perShareUnclaimedAmount);
    }

    function _transferAndUpdateRewardTokenHistoryForGivenUser(
        address _user,
        address _rewardToken,
        uint256 _unclaimedAmount,
        uint256 _perShareUnclaimedAmount
    ) private {
        UserStakingTokenContribution
            storage cInfo = usersStakingTokenContribution[_user];
        cInfo.rewardClaimed[_rewardToken] += _perShareUnclaimedAmount;
        require(
            _transferToken(
                _rewardToken,
                address(this),
                _user,
                _unclaimedAmount
            ) == HederaResponseCodes.SUCCESS,
            "Vault: Claim reward failed"
        );
    }
}
