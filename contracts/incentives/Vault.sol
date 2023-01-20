//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../common/IBaseHTS.sol";
import "../common/IERC20.sol";
import "../common/hedera/HederaTokenService.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "../common/hedera/HederaResponseCodes.sol";

contract Vault is Initializable {
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

    function initialize(
        address _stakingToken,
        uint256 _lockPeriod,
        IBaseHTS _tokenService
    ) public initializer {
        require(
            _stakingToken != address(0),
            "Staking token should not be empty."
        );
        lockPeriod = _lockPeriod;
        tokenService = _tokenService;
        tokenService.associateTokenPublic(address(this), _stakingToken);
        stakingToken = IERC20(_stakingToken);
    }

    //we need to set the amount of each reward address to the lastClaimed amount of the user
    function addStake(uint256 amount) external returns (uint256 timeStamp) {
        require(amount != 0, "Please provide amount");
        if (!userStakedTokenContribution[msg.sender].exist) {
            _setUpStaker(msg.sender);
            return _updateStakeContribution(msg.sender, amount);
        } else {
            claimAllReward(0, msg.sender);
            return _updateStakeContribution(msg.sender, amount);
        }
    }

    function addReward(
        address _token,
        uint256 _amount,
        address _fromAccount
    ) external {
        require(_amount != 0, "Please provide amount");
        require(stakingTokenTotalAmount != 0, "No token staked yet");
        uint256 perShareRewards;
        perShareRewards = _amount.div(stakingTokenTotalAmount);
        if (!rewards[_token].exist) {
            rewardTokens.push(_token);
            rewards[_token].exist = true;
            rewards[_token].amount = perShareRewards;
            tokenService.associateTokenPublic(address(this), _token);
            int256 responseCode = tokenService.transferTokenPublic(
                address(_token),
                address(_fromAccount),
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
                address(_fromAccount),
                address(this),
                int64(uint64(_amount))
            );
            require(
                responseCode == HederaResponseCodes.SUCCESS,
                "Vault: Add reward failed on token not exist."
            );
        }
    }

    function withdraw(uint256 startPosition, uint256 amount) public {
        require(amount != 0, "Please provide amount");
        _unlock(msg.sender);
        claimAllReward(startPosition, (msg.sender));
        bool isTransferSuccessful = stakingToken.transfer(msg.sender, amount);
        require(isTransferSuccessful, "Vault: Withdraw failed.");

        userStakedTokenContribution[msg.sender].shares -= amount;
        stakingTokenTotalAmount -= amount;
    }

    function _setUpStaker(address user) private {
        for (uint256 i; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            userStakedTokenContribution[user].lastClaimedAmount[
                token
            ] = rewards[token].amount;
            tokenService.associateTokenPublic(address(user), token);
        }
    }

    function _updateStakeContribution(
        address user,
        uint256 amount
    ) private returns (uint256 timeStamp) {
        tokenService.associateTokenPublic(address(this), address(stakingToken));
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

    function _unlock(address user) private view {
        require(
            (userStakedTokenContribution[user].lockTimeStart + lockPeriod) <
                block.timestamp,
            "you can't unlock your token because the lock period is not reached"
        );
    }

    function claimAllReward(
        uint256 startPosition,
        address user
    ) public returns (uint256, uint256) {
        for (
            uint256 i = startPosition;
            i < rewardTokens.length && i < startPosition + 10;
            i++
        ) {
            address token = rewardTokens[i];
            _claimRewardForToken(token, user);
        }
        return (startPosition, rewardTokens.length);
    }

    function claimSpecificReward(
        address[] memory tokens,
        address user
    ) public returns (uint256) {
        for (uint256 i; i < tokens.length; i++) {
            address token = tokens[i];
            _claimRewardForToken(token, user);
        }
        return tokens.length;
    }

    function _claimRewardForToken(address token, address user) private {
        uint256 reward;
        if (userStakedTokenContribution[user].lastClaimedAmount[token] == 0) {
            tokenService.associateTokenPublic(address(user), token);
        }
        reward = (rewards[token].amount -
            userStakedTokenContribution[user].lastClaimedAmount[token]).mul(
                userStakedTokenContribution[user].shares
            );
        userStakedTokenContribution[user].lastClaimedAmount[token] = rewards[
            token
        ].amount;

        bool isTransferSuccessful = IERC20(token).transfer(user, reward);
        require(isTransferSuccessful, "Vault: Claim reward failed.");
    }

    function getLockedAmount(address user) public view returns (uint256) {
        return userStakedTokenContribution[user].shares;
    }

    function getTotalVolume() public view returns (uint256) {
        return stakingTokenTotalAmount;
    }

    function getLockPeriod() public view returns (uint256) {
        return lockPeriod;
    }
}
