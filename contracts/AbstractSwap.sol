// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "./common/hedera/HederaResponseCodes.sol";
import "./common/IBaseHTS.sol";
import "./ILPToken.sol";

abstract contract AbstractSwap is HederaResponseCodes {

    IBaseHTS internal tokenService;
    ILPToken internal lpTokenContract;

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

    address internal creator;

    mapping (address => LiquidityContributor) liquidityContribution;

    Pair pair;

    function associateToken(address account,  address _token) internal virtual returns(int);

    function transferToken(address _token, address sender, address receiver, int64 amount) internal virtual returns(int);

    function initializeContract(address fromAccount, address _tokenA, address _tokenB, int64 _tokenAQty, int64 _tokenBQty) external {
        pair = Pair(Token(_tokenA, _tokenAQty), Token(_tokenB, _tokenBQty));
        liquidityContribution[fromAccount] = LiquidityContributor(pair);

        associateToken(address(this),  _tokenA);
        associateToken(address(this),  _tokenB);    

        int response = tokenService.transferTokenPublic(_tokenA, fromAccount, address(this), _tokenAQty);
        require(response == HederaResponseCodes.SUCCESS, "Creating contract: Transfering token A to contract failed with status code");

        response = tokenService.transferTokenPublic(_tokenB, fromAccount, address(this), _tokenBQty);
        require(response == HederaResponseCodes.SUCCESS, "Creating contract: Transfering token B to contract failed with status code");
        lpTokenContract.allotLPTokenFor(uint64(_tokenAQty), uint64(_tokenBQty), fromAccount);
    }

    function addLiquidity(address fromAccount, address _tokenA, address _tokenB, int64 _tokenAQty, int64 _tokenBQty) external {
        pair.tokenA.tokenQty += _tokenAQty;
        pair.tokenB.tokenQty += _tokenBQty;

        associateToken(address(this),  _tokenA);
        associateToken(address(this),  _tokenB);

        int response = tokenService.transferTokenPublic(_tokenA, fromAccount, address(this), _tokenAQty);
        require(response == HederaResponseCodes.SUCCESS, "Add liquidity: Transfering token A to contract failed with status code"); 
    
        response = tokenService.transferTokenPublic(_tokenB, fromAccount, address(this), _tokenBQty);
        require(response == HederaResponseCodes.SUCCESS, "Add liquidity: Transfering token B to contract failed with status code"); 
        LiquidityContributor memory contributedPair = liquidityContribution[fromAccount];
        contributedPair.pair.tokenA.tokenQty += _tokenAQty;
        contributedPair.pair.tokenB.tokenQty += _tokenBQty;
        liquidityContribution[fromAccount] = contributedPair;
        lpTokenContract.allotLPTokenFor(uint64(_tokenAQty), uint64(_tokenBQty), fromAccount);
    }

    function removeLiquidity(address toAccount, address _tokenA, address _tokenB, uint64 _lpToken) external {
        int64 _tokenAQty = 1;
        int64 _tokenBQty = 1;
        pair.tokenA.tokenQty -= _tokenAQty;
        pair.tokenB.tokenQty -= _tokenBQty;

        //Assumption - toAccount must be associated with tokenA and tokenB other transaction fails.
        int response = transferToken(_tokenA, address(this), toAccount, _tokenAQty);
        require(response == HederaResponseCodes.SUCCESS, "Remove liquidity: Transfering token A to contract failed with status code");
        response = transferToken(_tokenB, address(this), toAccount, _tokenBQty);
        require(response == HederaResponseCodes.SUCCESS, "Remove liquidity: Transfering token B to contract failed with status code");
        LiquidityContributor memory contributedPair = liquidityContribution[toAccount];
        contributedPair.pair.tokenA.tokenQty -= _tokenAQty;
        contributedPair.pair.tokenB.tokenQty -= _tokenBQty;
        liquidityContribution[toAccount] = contributedPair;
        lpTokenContract.removeLPTokenFor(_lpToken, toAccount);

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
        int response = transferToken(pair.tokenA.tokenAddress, to, address(this), _deltaAQty);
        require(response == HederaResponseCodes.SUCCESS, "swapTokenA: Transfering token A to contract failed with status code");

        pair.tokenB.tokenQty -= deltaBQty;
        associateToken(to,  _tokenB);
        response = transferToken(pair.tokenB.tokenAddress, address(this), to, deltaBQty);
        require(response == HederaResponseCodes.SUCCESS, "swapTokenA: Transfering token B to contract failed with status code");
    }

    function doTokenBSwap(address to, address _tokenA, address _tokenB, int64 _deltaBQty) private  {
        require(_tokenA != pair.tokenA.tokenAddress && _tokenB == pair.tokenB.tokenAddress, "Token B should have correct address and token A address will be ignored.");
        int64 deltaAQty = (pair.tokenA.tokenQty * _deltaBQty) / (pair.tokenB.tokenQty + _deltaBQty);
        pair.tokenB.tokenQty += _deltaBQty;
        int response = transferToken(pair.tokenB.tokenAddress, to, address(this), _deltaBQty);
        require(response == HederaResponseCodes.SUCCESS, "swapTokenB: Transfering token B to contract failed with status code");

        pair.tokenA.tokenQty -= deltaAQty;
        associateToken(to,  _tokenA);
        response = transferToken(pair.tokenA.tokenAddress, address(this), to, deltaAQty);
        require(response == HederaResponseCodes.SUCCESS, "swapTokenB: Transfering token A to contract failed with status code");
    }

    function getPairQty() public view returns (int64, int64) {
        return (pair.tokenA.tokenQty, pair.tokenB.tokenQty);
    }

    function getContributorTokenShare(address fromAccount) public view returns (int64, int64) {
        LiquidityContributor memory liquidityContributor = liquidityContribution[fromAccount];
        return (liquidityContributor.pair.tokenA.tokenQty, liquidityContributor.pair.tokenB.tokenQty);
    }

    function getSpotPrice() public view returns (uint) {
        uint precision = uint(int(getPrecisionValue()));
        uint tokenAQ = uint(int(pair.tokenA.tokenQty));
        uint tokenBQ = uint(int(pair.tokenB.tokenQty));
        uint value = (tokenAQ * precision)/tokenBQ;
        return value;
    }

    function getOutGivenIn(int64 amountTokenA) public view returns(int64) {
        int64 invariantValue = getVariantValue();
        int64 precision = getPrecisionValue();
        int64 tokenAQ = pair.tokenA.tokenQty;
        int64 tokenBQ = pair.tokenB.tokenQty;

        int64 amountTokenB = (tokenBQ * precision) - (invariantValue / (tokenAQ + amountTokenA));
        return amountTokenB;
    }

    function getInGivenOut(int64 amountTokenB) public view returns(int64) {
        int64 precision = getPrecisionValue();
        int64 invariantValue = getVariantValue();
        int64 amountTokenA = ((invariantValue) / (pair.tokenB.tokenQty - amountTokenB)) - (pair.tokenA.tokenQty * precision);
        return amountTokenA;
    }

    function getVariantValue() public view returns(int64) {
        int64 precision = getPrecisionValue();
        return (pair.tokenA.tokenQty * pair.tokenB.tokenQty) * precision;
    }

    function getPrecisionValue() public pure returns(int64) {
        return 10000000;
    }
}
