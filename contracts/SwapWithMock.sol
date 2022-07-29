//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./HederaResponseCodes.sol";
import "./IBaseHTS.sol";

contract SwapWithMock is HederaResponseCodes {
    IBaseHTS tokenService;
    
    struct Pair {
        Token tokenA;
        Token tokenB;
    }

    struct Token {
        address tokenAddress;
        int64 tokenQty;
    }

    struct LiquidityContributor {
        Pair pair;
    }

    address creator;

    mapping (address => LiquidityContributor) liquidityContribution;

    Pair pair;

    modifier onlyOwner {
      require(msg.sender == creator, "Only owner can change the contract.");
      _;
   }

    event SetMessage(address indexed from, int message);

    constructor(IBaseHTS _tokenService) {
       creator = msg.sender;
       tokenService = _tokenService;
    }

    function initializeContract(address fromAccount, address _tokenA, address _tokenB, int64 _tokenAQty, int64 _tokenBQty) external {
        pair = Pair(Token(_tokenA, _tokenAQty), Token(_tokenB, _tokenBQty));
        liquidityContribution[fromAccount] = LiquidityContributor(pair);
        //Not verifying assert response because if already associated it fails.
        int response = tokenService.associateTokenPublic(address(this), _tokenA);
        emit SetMessage(fromAccount, response);
        //tokenService.associateTokenPublic(address(this), _tokenA);
        //tokenService.associateTokenPublic(address(this), _tokenB);
        
        //int response = tokenService.transferTokenPublic(_tokenA, fromAccount, address(this), _tokenAQty);
        //require(response == HederaResponseCodes.SUCCESS, "Creating contract: Transfering token A to contract failed with status code");

        //response = tokenService.transferTokenPublic(_tokenB, fromAccount, address(this), _tokenBQty);
        //require(response == HederaResponseCodes.SUCCESS, "Creating contract: Transfering token B to contract failed with status code");
    }

    function addLiquidity(address fromAccount, address _tokenA, address _tokenB, int64 _tokenAQty, int64 _tokenBQty) external {
        pair.tokenA.tokenQty += _tokenAQty;
        pair.tokenB.tokenQty += _tokenBQty;

        int response = tokenService.associateTokenPublic(address(this), _tokenA);
        emit SetMessage(fromAccount, response);
        tokenService.associateTokenPublic(address(this), _tokenB);

        response = tokenService.transferTokenPublic(_tokenA, fromAccount, address(this), _tokenAQty);
        emit SetMessage(fromAccount, response);
        require(response == HederaResponseCodes.SUCCESS, "Add liquidity: Transfering token A to contract failed with status code");

        response = tokenService.transferTokenPublic(_tokenB, fromAccount, address(this), _tokenBQty);
        require(response == HederaResponseCodes.SUCCESS, "Add liquidity: Transfering token B to contract failed with status code");

        LiquidityContributor memory contributedPair = liquidityContribution[fromAccount];
        contributedPair.pair.tokenA.tokenQty += _tokenAQty;
        contributedPair.pair.tokenB.tokenQty += _tokenBQty;
        liquidityContribution[fromAccount] = contributedPair;
    }

    function removeLiquidity(address toAccount, address _tokenA, address _tokenB, int64 _tokenAQty, int64 _tokenBQty) external {
        pair.tokenA.tokenQty -= _tokenAQty;
        pair.tokenB.tokenQty -= _tokenBQty;
        //Assumption - toAccount must be associated with tokenA and tokenB other transaction fails.
        int response = tokenService.transferTokenPublic(_tokenA, address(this), toAccount, _tokenAQty);
        require(response == HederaResponseCodes.SUCCESS, "Remove liquidity: Transfering token A to contract failed with status code");
        response = tokenService.transferTokenPublic(_tokenB, address(this),  toAccount, _tokenBQty);
        require(response == HederaResponseCodes.SUCCESS, "Remove liquidity: Transfering token B to contract failed with status code");
        LiquidityContributor memory contributedPair = liquidityContribution[toAccount];
        contributedPair.pair.tokenA.tokenQty -= _tokenAQty;
        contributedPair.pair.tokenB.tokenQty -= _tokenBQty;
        liquidityContribution[toAccount] = contributedPair;
    }

    function swapToken(address to, address _tokenA, address _tokenB, int64 _deltaAQty, int64 _deltaBQty) external {
        require(_tokenA == pair.tokenA.tokenAddress || _tokenB == pair.tokenB.tokenAddress, "Pls pass correct token to swap.");

        if (_tokenA == pair.tokenA.tokenAddress) {
            doTokenASwap(to, _tokenA, _tokenB, _deltaAQty);
        } else {
            doTokenBSwap(to, _tokenA, _tokenB, _deltaBQty);
        }     
    }

    function doTokenASwap(address to, address _tokenA, address _tokenB, int64 _deltaAQty) private  {
        require(_tokenA == pair.tokenA.tokenAddress && _tokenB != pair.tokenB.tokenAddress, "Token A should have correct address and token B address will be ignored.");
        int64 deltaBQty = (pair.tokenB.tokenQty * _deltaAQty) / (pair.tokenA.tokenQty + _deltaAQty);
        pair.tokenA.tokenQty += _deltaAQty;  
        int response = tokenService.transferTokenPublic(pair.tokenA.tokenAddress, to, address(this), _deltaAQty);
        require(response == HederaResponseCodes.SUCCESS, "swapTokenA: Transfering token A to contract failed with status code");

        pair.tokenB.tokenQty -= deltaBQty;
        tokenService.associateTokenPublic(to, _tokenB);
        response = tokenService.transferTokenPublic(pair.tokenB.tokenAddress, address(this), to, deltaBQty);
        require(response == HederaResponseCodes.SUCCESS, "swapTokenA: Transfering token B to contract failed with status code");
    }

    function doTokenBSwap(address to, address _tokenA, address _tokenB, int64 _deltaBQty) private  {
        require(_tokenA != pair.tokenA.tokenAddress && _tokenB == pair.tokenB.tokenAddress, "Token B should have correct address and token A address will be ignored.");
        int64 deltaAQty = (pair.tokenA.tokenQty * _deltaBQty) / (pair.tokenB.tokenQty + _deltaBQty);
        pair.tokenB.tokenQty += _deltaBQty;
        int response = tokenService.transferTokenPublic(pair.tokenB.tokenAddress, to, address(this), _deltaBQty);
        require(response == HederaResponseCodes.SUCCESS, "swapTokenB: Transfering token B to contract failed with status code");

        pair.tokenA.tokenQty -= deltaAQty;
        tokenService.associateTokenPublic(to, _tokenA);
        response = tokenService.transferTokenPublic(pair.tokenA.tokenAddress, address(this), to, deltaAQty);
        require(response == HederaResponseCodes.SUCCESS, "swapTokenB: Transfering token A to contract failed with status code");
    }

    function getPairQty() public view returns (int64, int64) {
        return (pair.tokenA.tokenQty, pair.tokenB.tokenQty);
    }

    function getContributorTokenShare(address fromAccount) public view returns (int64, int64) {
        LiquidityContributor memory liquidityContributor = liquidityContribution[fromAccount];
        return (liquidityContributor.pair.tokenA.tokenQty, liquidityContributor.pair.tokenB.tokenQty);
    }
}
