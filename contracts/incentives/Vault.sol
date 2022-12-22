//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../common/IBaseHTS.sol";
import "../common/IERC20.sol";
import "../common/hedera/HederaTokenService.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "../common/hedera/HederaResponseCodes.sol";

contract Vault is HederaResponseCodes, Initializable {
    struct UserInfo {
        uint256 shares;
        mapping(address => uint256) lastClaimedAmount;
        uint256 lockTimeStart;
        bool exist;
    }

    struct RewardsInfo {
        uint256 amount;
        bool exist;
    }

    using PRBMathUD60x18 for uint256;
    IERC20 private stakingToken;
    uint256 private lockPeriod;
    uint256 private stakingTokenTotalAmount;
    address[] private rewardTokens;
    address private owner;
    IBaseHTS private tokenService;
    mapping(address => UserInfo) public userStakedTokenContribution;
    mapping(address => RewardsInfo) public rewards;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    function initialize(
        address _stakingToken,
        uint256 _lockPeriod,
        IBaseHTS _tokenService
    ) public initializer {
        require(
            _stakingToken != address(0),
            "Staking token should not be empty."
        );
        owner = msg.sender;
        lockPeriod = _lockPeriod;
        tokenService = _tokenService;
        tokenService.associateTokenPublic(_stakingToken, address(this));
        stakingToken = IERC20(_stakingToken);
    }

    //we need to set the amount of each reward address to the lastClaimed amount of the user
    function addStakeAccount(uint256 _amount)
        public
        returns (uint256 timeStamp)
    {
        require(_amount != 0, "Please provide amount");
        if (!userStakedTokenContribution[msg.sender].exist) {
            _setUpStaker(msg.sender);
            return _updateStakeContribution(msg.sender, _amount);
        } else {
            claimAllReward(0);
            return _updateStakeContribution(msg.sender, _amount);
        }
    }

    function _setUpStaker(address user) private {
        for (uint256 i; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            userStakedTokenContribution[user].lastClaimedAmount[
                    token
                ] = rewards[token].amount;
            tokenService.associateTokenPublic(token, address(user));
        }
    }

    function _updateStakeContribution(address user, uint256 amount)
        private
        returns (uint256 timeStamp)
    {
        int256 responseCode = tokenService.transferTokenPublic(
            address(stakingToken),
            user,
            address(this),
            int64(uint64(amount))
        );
        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "Vault: Add stake failed."
        );
        userStakedTokenContribution[user].shares += amount;
        userStakedTokenContribution[user].exist = true;
        userStakedTokenContribution[user].lockTimeStart = block.timestamp;
        stakingTokenTotalAmount += amount;
        return block.timestamp;
    }

    function addReward(address _token, uint256 _amount) public onlyOwner {
        require(_amount != 0, "Please provide amount");
        require(stakingTokenTotalAmount != 0, "No token staked yet");
        uint256 perShareRewards;
        perShareRewards = _amount.div(stakingTokenTotalAmount);
        if (!rewards[_token].exist) {
            rewardTokens.push(_token);
            rewards[_token].exist = true;
            rewards[_token].amount = perShareRewards;
            tokenService.associateTokenPublic(_token, address(this));
            int256 responseCode = tokenService.transferTokenPublic(
                address(_token),
                address(owner),
                address(this),
                int64(uint64(_amount))
            );
            require(
                responseCode == HederaResponseCodes.SUCCESS,
                "Vault: Add reward failed on token exist."
            );
        } else {
            rewards[_token].amount += perShareRewards;
            int256 responseCode = tokenService.transferTokenPublic(
                address(_token),
                address(owner),
                address(this),
                int64(uint64(_amount))
            );
            require(
                responseCode == HederaResponseCodes.SUCCESS,
                "Vault: Add reward failed on token not exist."
            );
        }
    }

    function withdraw(uint256 _startPosition, uint256 _amount) public {
        require(_amount != 0, "Please provide amount");
        unlock(_startPosition, _amount);
        claimAllReward(_startPosition);
        int256 responseCode = tokenService.transferTokenPublic(
            address(stakingToken),
            address(this),
            address(msg.sender),
            int64(uint64(_amount))
        );
        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "Withdraw failed."
        );

        userStakedTokenContribution[msg.sender].shares -= _amount;
        stakingTokenTotalAmount -= _amount;
    }

    function unlock(uint256 _startPosition, uint256 _amount)
        internal
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        if (
            (userStakedTokenContribution[msg.sender].lockTimeStart +
                lockPeriod) < block.timestamp
        ) {
            return (
                block.timestamp,
                userStakedTokenContribution[msg.sender].lockTimeStart,
                lockPeriod
            );
        } else {
            revert(
                "you can't unlock your token because the lock period is not reached"
            );
        }
    }

    function claimAllReward(uint256 _startPosition)
        public
        returns (uint256, uint256)
    {
        for (
            uint256 i = _startPosition;
            i < rewardTokens.length && i < _startPosition + 10;
            i++
        ) {
            address token = rewardTokens[i];
            _claimRewardForToken(token);
        }
        return (_startPosition, rewardTokens.length);
    }

    function claimSpecificReward(address[] memory _token)
        public
        returns (uint256)
    {
        for (uint256 i; i < _token.length; i++) {
            uint256 reward;
            address token = _token[i];
            _claimRewardForToken(token);
        }
        return _token.length;
    }

    function _claimRewardForToken(address token) private {
        uint256 reward;
        if (
            userStakedTokenContribution[msg.sender].lastClaimedAmount[token] ==
            0
        ) {
            tokenService.associateTokenPublic(token, address(msg.sender));
        }
        reward = (rewards[token].amount -
            userStakedTokenContribution[msg.sender].lastClaimedAmount[token])
            .mul(userStakedTokenContribution[msg.sender].shares);
        userStakedTokenContribution[msg.sender].lastClaimedAmount[
            token
        ] = rewards[token].amount;

        int256 responseCode = tokenService.transferTokenPublic(
            address(token),
            address(this),
            address(msg.sender),
            int64(uint64(reward))
        );
        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "Claim reward failed."
        );
    }

    function getLockedAmount() public view returns (uint256) {
        return userStakedTokenContribution[msg.sender].shares;
    }

    function getTotalVolume() public view returns (uint256) {
        return stakingTokenTotalAmount;
    }

    function getLockPeriod() public view returns (uint256) {
        return lockPeriod;
    }
}
