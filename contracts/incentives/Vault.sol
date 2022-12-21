//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../common/IBaseHTS.sol";
import "../common/IERC20.sol";
import "../common/hedera/HederaTokenService.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "../common/hedera/HederaResponseCodes.sol";

import "hardhat/console.sol";

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
    uint256 private totalTokens;
    address[] private tokenAddress;
    address private owner;
    IBaseHTS private tokenService;
    mapping(address => UserInfo) public userContribution;
    mapping(address => RewardsInfo) public rewardsAddress;

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
        console.log(owner);
        lockPeriod = _lockPeriod;
        tokenService = _tokenService;
        tokenService.associateTokenPublic(_stakingToken, address(this));
        stakingToken = IERC20(_stakingToken);
    }

    //we need to set the amount of each reward address to the lastClaimed amount of the user
    function addStakeAccount(uint256 _amount)
        internal
        returns (uint256 timeStamp)
    {
        if (!userContribution[msg.sender].exist) {
            for (uint256 i; i < tokenAddress.length; i++) {
                address token = tokenAddress[i];
                userContribution[msg.sender].lastClaimedAmount[
                        token
                    ] = rewardsAddress[token].amount;
                tokenService.associateTokenPublic(token, address(msg.sender));
            }
            int256 responseCode = tokenService.transferTokenPublic(
                address(stakingToken),
                msg.sender,
                address(this),
                int64(uint64(_amount))
            );
            require(
                responseCode == HederaResponseCodes.SUCCESS,
                "Vault: Add stake failed when contributor does not exist."
            );
            userContribution[msg.sender].shares = _amount;
            userContribution[msg.sender].exist = true;
            userContribution[msg.sender].lockTimeStart = block.timestamp;
            totalTokens += _amount;
            return block.timestamp;
        } else {
            claimAllReward(0);
            int256 responseCode = tokenService.transferTokenPublic(
                address(stakingToken),
                msg.sender,
                address(this),
                int64(uint64(_amount))
            );
            require(
                responseCode == HederaResponseCodes.SUCCESS,
                "Vault: Add stake failed when contributor exist."
            );
            userContribution[msg.sender].shares += _amount;
            userContribution[msg.sender].lockTimeStart = block.timestamp;
            totalTokens += _amount;
        }
    }

    function addReward(address _token, uint256 _amount) internal onlyOwner {
        require(totalTokens != 0, "No token staked yet");
        uint256 perShareRewards;
        perShareRewards = _amount.div(totalTokens);
        if (!rewardsAddress[_token].exist) {
            tokenAddress.push(_token);
            rewardsAddress[_token].exist = true;
            rewardsAddress[_token].amount = perShareRewards;
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
            rewardsAddress[_token].amount += perShareRewards;
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

    function addToken(address _token, uint256 _amount) public {
        require(_amount != 0, "Please provide amount");
        if (_token == address(stakingToken)) {
            addStakeAccount(_amount);
        } else {
            addReward(_token, _amount);
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

        userContribution[msg.sender].shares -= _amount;
        totalTokens -= _amount;
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
            (userContribution[msg.sender].lockTimeStart + lockPeriod) <
            block.timestamp
        ) {
            return (
                block.timestamp,
                userContribution[msg.sender].lockTimeStart,
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
            i < tokenAddress.length && i < _startPosition + 10;
            i++
        ) {
            uint256 reward;
            address token = tokenAddress[i];
            if (userContribution[msg.sender].lastClaimedAmount[token] == 0) {
                tokenService.associateTokenPublic(token, address(msg.sender));
            }
            reward = (rewardsAddress[token].amount -
                userContribution[msg.sender].lastClaimedAmount[token]).mul(
                    userContribution[msg.sender].shares
                );
            userContribution[msg.sender].lastClaimedAmount[
                token
            ] = rewardsAddress[token].amount;

            int256 responseCode = tokenService.transferTokenPublic(
                address(token),
                address(this),
                address(msg.sender),
                int64(uint64(reward))
            );
            require(
                responseCode == HederaResponseCodes.SUCCESS,
                "Claim all reward failed."
            );
        }
        return (_startPosition, tokenAddress.length);
    }

    function getLockedAmount() public view returns (uint256) {
        return userContribution[msg.sender].shares;
    }

    function getTotalVolume() public view returns (uint256) {
        return totalTokens;
    }

    function getLockPeriod() public view returns (uint256) {
        return lockPeriod;
    }

    function claimSpecificReward(address[] memory _token)
        public
        returns (uint256)
    {
        for (uint256 i; i < _token.length; i++) {
            uint256 reward;
            address token = _token[i];
            if (userContribution[msg.sender].lastClaimedAmount[token] == 0) {
                tokenService.associateTokenPublic(token, address(msg.sender));
            }
            reward = (rewardsAddress[token].amount -
                userContribution[msg.sender].lastClaimedAmount[token]).mul(
                    userContribution[msg.sender].shares
                );
            userContribution[msg.sender].lastClaimedAmount[
                token
            ] = rewardsAddress[token].amount;

            int256 responseCode = tokenService.transferTokenPublic(
                address(token),
                address(this),
                address(msg.sender),
                int64(uint64(reward))
            );
            require(
                responseCode == HederaResponseCodes.SUCCESS,
                "Claim specific reward failed."
            );
        }
        return _token.length;
    }
}
