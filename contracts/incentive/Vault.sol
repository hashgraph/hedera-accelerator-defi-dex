//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma abicoder v2;

import "../common/IBaseHTS.sol";
import "../common/IERC20.sol";
import "../common/hedera/HederaTokenService.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "../common/hedera/HederaResponseCodes.sol";

import "hardhat/console.sol";

contract Vault is HederaResponseCodes {

    struct UserInfo {
        uint shares;
        mapping(address => uint) lastClaimedAmount;
        uint lockTimeStart;
        bool exist;
    }

    struct RewardsInfo {
        uint amount;
        bool exist;
    }

    using PRBMathUD60x18 for uint256;
    IERC20 private stakingToken;
    uint private lockPeriod;
    uint private totalTokens;
    address[] private tokenAddress;
    address private owner;
    IBaseHTS private tokenService;
    mapping(address =>  UserInfo) public userContribution;
    mapping (address => RewardsInfo) public rewardsAddress;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    function initialize(address _stakingToken, uint _lockPeriod, IBaseHTS _tokenService) public {
        require(_stakingToken != address(0), "Staking token should not be empty.");
        owner = msg.sender;
        console.log(owner);
        lockPeriod = _lockPeriod;
        tokenService = _tokenService;
        tokenService.associateTokenPublic(_stakingToken, address(this));
        stakingToken = IERC20(_stakingToken);
    }

    //we need to set the amount of each reward address to the lastClaimed amount of the user
    function addStakeAccount(uint _amount) internal returns (uint timeStamp) { 
        require(_amount != 0, "Staking amount should be greater than zero.");
        
        if(!userContribution[msg.sender].exist) {
            for(uint i; i < tokenAddress.length; i++){
            address token = tokenAddress[i];
            userContribution[msg.sender].lastClaimedAmount[token] = rewardsAddress[token].amount;
            tokenService.associateTokenPublic(token, address(msg.sender));
        }
            int responseCode = tokenService.transferTokenPublic(address(stakingToken), msg.sender, address(this), int64(uint64(_amount)));
            require(responseCode == HederaResponseCodes.SUCCESS, "Add stake failed when contributor does not exist.");
            userContribution[msg.sender].shares = _amount;
            userContribution[msg.sender].exist = true;
            userContribution[msg.sender].lockTimeStart = block.timestamp;
            totalTokens += _amount;
            return block.timestamp;
        } else {
            claimAllReward(0);
            int responseCode = tokenService.transferTokenPublic(address(stakingToken), msg.sender, address(this), int64(uint64(_amount)));
            require(responseCode == HederaResponseCodes.SUCCESS, "Add stake failed when contributor exist.");
            userContribution[msg.sender].shares += _amount;
            userContribution[msg.sender].lockTimeStart = block.timestamp;
            totalTokens += _amount;
        }
    }

    function addReward(address _token, uint _amount) internal onlyOwner {
        require(_amount != 0, "Please provide amount");
        require(totalTokens != 0, "No token staked yet");
        uint perShareRewards;
        perShareRewards = _amount.div(totalTokens);
        if(!rewardsAddress[_token].exist) {
            tokenAddress.push(_token);
            rewardsAddress[_token].exist = true;
            rewardsAddress[_token].amount = perShareRewards;
            tokenService.associateTokenPublic(_token, address(this));
            int responseCode = tokenService.transferTokenPublic(address(_token), address(owner), address(this), int64(uint64(_amount)));
            require(responseCode == HederaResponseCodes.SUCCESS, "Add reward failed when token does not exist.");
        } else {
            rewardsAddress[_token].amount += perShareRewards;
            int responseCode = tokenService.transferTokenPublic(address(_token), address(owner), address(this), int64(uint64(_amount)));
            require(responseCode == HederaResponseCodes.SUCCESS, "Add reward failed when token exist.");
        }     
    }

    function addToken(address _token, uint _amount) public {
        require(_amount != 0, "Please provide amount");
        if(_token == address(stakingToken)) {
            addStakeAccount(_amount);
        } else {
            addReward(_token, _amount);
        }
    }

    function withdraw(uint _startPosition, uint _amount) public {
        require(_amount != 0, "Please provide amount");
        unlock(_startPosition, _amount);
        claimAllReward(_startPosition);
        int responseCode = tokenService.transferTokenPublic(address(stakingToken), address(this), address(msg.sender), int64(uint64(_amount)));
        require(responseCode == HederaResponseCodes.SUCCESS, "Withdraw failed.");

        userContribution[msg.sender].shares -= _amount;
        totalTokens -= _amount;
    }

    function unlock(uint _startPosition, uint _amount) internal returns(uint, uint, uint) {
        if((userContribution[msg.sender].lockTimeStart + lockPeriod) < block.timestamp) {
            return (block.timestamp,userContribution[msg.sender].lockTimeStart,lockPeriod);
        } else {
            revert("you can't unlock your token because the lock period is not reached");
        }
    }

    function claimAllReward(uint _startPosition) public returns (uint, uint) {
        for(uint i = _startPosition; i < tokenAddress.length && i < _startPosition + 10; i++) {
            uint reward;
            address token = tokenAddress[i];
            if(userContribution[msg.sender].lastClaimedAmount[token] == 0){
                tokenService.associateTokenPublic(token, address(msg.sender));
            }
            reward = (rewardsAddress[token].amount - userContribution[msg.sender].lastClaimedAmount[token]).mul(userContribution[msg.sender].shares);
            userContribution[msg.sender].lastClaimedAmount[token] = rewardsAddress[token].amount;

            int responseCode = tokenService.transferTokenPublic(address(token), address(this), address(msg.sender), int64(uint64(reward)));
            require(responseCode == HederaResponseCodes.SUCCESS, "Claim all reward failed.");
        }
        return (_startPosition, tokenAddress.length);
    }

    function getLockedAmount() public view returns (uint) {
        return userContribution[msg.sender].shares;
    }

    function getTotalVolume() public view returns (uint) {
        return totalTokens;
    }

    function getLockPeriod() public view returns (uint) {
        return lockPeriod;
    }

    function claimSpecificReward(address[] memory _token) public returns (uint) {
        for(uint i; i < _token.length; i++){
            uint reward;
            address token = _token[i];
            if(userContribution[msg.sender].lastClaimedAmount[token] == 0) {
                tokenService.associateTokenPublic(token, address(msg.sender));
            }
            reward = (rewardsAddress[token].amount - userContribution[msg.sender].lastClaimedAmount[token]).mul(userContribution[msg.sender].shares);
            userContribution[msg.sender].lastClaimedAmount[token] = rewardsAddress[token].amount;
            
            int responseCode = tokenService.transferTokenPublic(address(token), address(this), address(msg.sender), int64(uint64(reward)));
            require(responseCode == HederaResponseCodes.SUCCESS, "Claim specific reward failed.");
        }
        return _token.length;
    }

}



