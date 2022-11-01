// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "./common/hedera/HederaResponseCodes.sol";
import "./common/IBaseHTS.sol";
import "./ILPToken.sol";
import "./IPair.sol";

abstract contract AbstractPair is IPair, HederaResponseCodes {

    IBaseHTS internal tokenService;
    ILPToken internal lpTokenContract;

    struct LiquidityContributor {
        Pair pair;
    }

    address internal creator;

    mapping (address => LiquidityContributor) liquidityContribution;

    Pair pair;

    int slippage;

    int private fee;

    address private treasury;

    function getPair() external override view returns (Pair memory) {
        return pair;
    }

    function initializeContract(address fromAccount, address _tokenA, address _tokenB, int _tokenAQty, int _tokenBQty, int _fee, address _treasury) external override virtual  {
        pair = Pair(Token(_tokenA, _tokenAQty), Token(_tokenB, _tokenBQty));
        liquidityContribution[fromAccount] = LiquidityContributor(pair);
        
        fee = _fee;

        treasury = _treasury;
        
        associateToken(address(this),  _tokenA);
        associateToken(address(this),  _tokenB);    

        int response = transferToken(_tokenA, fromAccount, address(this), _tokenAQty);
        require(response == HederaResponseCodes.SUCCESS, "Creating contract: Transfering token A to contract failed with status code");

        response = transferToken(_tokenB, fromAccount, address(this), _tokenBQty);
        require(response == HederaResponseCodes.SUCCESS, "Creating contract: Transfering token B to contract failed with status code");
        lpTokenContract.allotLPTokenFor(_tokenAQty, _tokenBQty, fromAccount);
    }

    function addLiquidity(address fromAccount, address _tokenA, address _tokenB, int _tokenAQty, int _tokenBQty) external override virtual {
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
        lpTokenContract.allotLPTokenFor(_tokenAQty, _tokenBQty, fromAccount);
    }

    function removeLiquidity(address fromAccount, int _lpToken) external override virtual {
        require(lpTokenContract.lpTokenForUser(fromAccount) > _lpToken, "user does not have sufficient lpTokens");
        (int _tokenAQty, int _tokenBQty) = calculateTokenstoGetBack(_lpToken);
        //Assumption - toAccount must be associated with tokenA and tokenB other transaction fails.
        int response = transferToken(pair.tokenA.tokenAddress, address(this), fromAccount, _tokenAQty);
        require(response == HederaResponseCodes.SUCCESS, "Remove liquidity: Transferring token A to contract failed with status code");
        response = transferToken(pair.tokenB.tokenAddress, address(this), fromAccount, _tokenBQty);
        require(response == HederaResponseCodes.SUCCESS, "Remove liquidity: Transferring token B to contract failed with status code");
        pair.tokenA.tokenQty -= _tokenAQty;
        pair.tokenB.tokenQty -= _tokenBQty;
        
        lpTokenContract.removeLPTokenFor(_lpToken, fromAccount);

    }

    function calculateTokenstoGetBack(int _lpToken) internal view returns (int, int) {
        int allLPTokens = lpTokenContract.getAllLPTokenCount();

        int tokenAQuantity = (_lpToken * pair.tokenA.tokenQty)/allLPTokens;
        int tokenBQuantity = (_lpToken * pair.tokenB.tokenQty)/allLPTokens;

        return (tokenAQuantity, tokenBQuantity);
    }

    function swapToken(address to, address _tokenA, address _tokenB, int _deltaAQty, int _deltaBQty) external override virtual {
        require(_tokenA == pair.tokenA.tokenAddress || _tokenB == pair.tokenB.tokenAddress, "Pls pass correct token to swap.");

        if (_tokenA == pair.tokenA.tokenAddress) {
            doTokenASwap(to, _tokenA, _tokenB, _deltaAQty);
        } else {
            doTokenBSwap(to, _tokenA, _tokenB, _deltaBQty);
        }     
    }

    function doTokenASwap(address to, address _tokenA, address _tokenB, int _deltaAQty) private  {
        require(_tokenA == pair.tokenA.tokenAddress && _tokenB != pair.tokenB.tokenAddress, "Token A should have correct address and token B address will be ignored.");
        int calculatedSlippage = slippageOutGivenIn(_deltaAQty);
        int localSlippage = getSlippage();
        require(calculatedSlippage <= (localSlippage),  "Slippage threshold breached.");
        // deduct fee from the token A
        int feeTokenA = feeForToken(_deltaAQty);
        _deltaAQty = _deltaAQty - (feeTokenA/2);
        
        int deltaBQty = getOutGivenIn(_deltaAQty);
        pair.tokenA.tokenQty += _deltaAQty;  
        int feeTokenB = feeForToken(deltaBQty);
        // deduct fee from the token B
        deltaBQty = deltaBQty - (feeTokenB/2);
        int response = transferToken(pair.tokenA.tokenAddress, to, address(this), _deltaAQty);
        require(response == HederaResponseCodes.SUCCESS, "swapTokenA: Transferring token A to contract failed with status code");

        pair.tokenB.tokenQty -= deltaBQty;
        associateToken(to,  _tokenB);
        response = transferToken(pair.tokenB.tokenAddress, address(this), to, deltaBQty);
        require(response == HederaResponseCodes.SUCCESS, "swapTokenA: Transferring token B to contract failed with status code");

        transferFeeToTreasury(feeTokenA/2, feeTokenB/2);
    }

    function doTokenBSwap(address to, address _tokenA, address _tokenB, int _deltaBQty) private  {
        require(_tokenA != pair.tokenA.tokenAddress && _tokenB == pair.tokenB.tokenAddress, "Token B should have correct address and token A address will be ignored.");
        int calculatedSlippage = slippageInGivenOut(_deltaBQty);
        int localSlippage = getSlippage();
        require(calculatedSlippage <= localSlippage,  "Slippage threshold breached.");
        // deduct fee from the token B
        int feeTokenB = feeForToken(_deltaBQty);
        _deltaBQty -= (feeTokenB/2);
        int deltaAQty = getInGivenOut(_deltaBQty);
        pair.tokenB.tokenQty += _deltaBQty;
        int feeTokenA = feeForToken(deltaAQty);
        // deduct fee from the token A
        deltaAQty -= (feeTokenA/2);
        int response = transferToken(pair.tokenB.tokenAddress, to, address(this), _deltaBQty);
        require(response == HederaResponseCodes.SUCCESS, "swapTokenB: Transferring token B to contract failed with status code");

        pair.tokenA.tokenQty -= deltaAQty;
        associateToken(to,  _tokenA);
        response = transferToken(pair.tokenA.tokenAddress, address(this), to, deltaAQty);
        require(response == HederaResponseCodes.SUCCESS, "swapTokenB: Transferring token A to contract failed with status code");

        transferFeeToTreasury(feeTokenA/2, feeTokenB/2);
    }

    function getPairQty() public view returns (int, int) {
        return (pair.tokenA.tokenQty, pair.tokenB.tokenQty);
    }

    function getContributorTokenShare(address fromAccount) public view returns (int, int) {
        LiquidityContributor memory liquidityContributor = liquidityContribution[fromAccount];
        return (liquidityContributor.pair.tokenA.tokenQty, liquidityContributor.pair.tokenB.tokenQty);
    }

    function getSpotPrice() public view returns (int) {
        int precision = getPrecisionValue();
        int tokenAQ = pair.tokenA.tokenQty;
        int tokenBQ = pair.tokenB.tokenQty;
        int value = (tokenAQ * precision)/tokenBQ;
        return value;
    }

    function getInGivenOut(int amountTokenB) public view returns(int) {
        int invariantValue = getVariantValue();
        int precision = getPrecisionValue();
        int tokenAQ = pair.tokenA.tokenQty;
        int tokenBQ = pair.tokenB.tokenQty;
        int adjustedValue = (invariantValue * precision)/ (tokenBQ - amountTokenB);
        int newValue = adjustedValue/precision;
        int amountTokenA = newValue - tokenAQ;
        return amountTokenA;
    }

    function getVariantValue() public view returns(int) {
        int tokenAQ = pair.tokenA.tokenQty;
        int tokenBQ = pair.tokenB.tokenQty;
        return tokenAQ * tokenBQ;
    }

    function getPrecisionValue() public pure returns(int) {
        return 10000000;
    }

    function getOutGivenIn(int amountTokenA) public view returns(int) {
        int precision = getPrecisionValue();
        int invariantValue = getVariantValue();
        int tokenAQ = pair.tokenA.tokenQty;
        int tokenBQ = pair.tokenB.tokenQty;
        int adjustedValue = (invariantValue * precision) / (tokenAQ + amountTokenA);
        int newValue = adjustedValue/precision;
        int amountTokenB = tokenBQ - newValue;
        return amountTokenB;
    }

    function getSlippage() public view returns(int) {
        // 0.005 should be default as per requirement.
        return (slippage <= 0) ? int(50000) : slippage;
    }

    function setSlippage(int _slippage) external returns(int) {
        slippage = _slippage;
        return slippage;
    }

    function slippageOutGivenIn(int _tokenAQty) public view returns (int) {
        int precision = getPrecisionValue();
        int tokenAQ = pair.tokenA.tokenQty;
        int tokenBQ = pair.tokenB.tokenQty;
        int unitPriceForA = (tokenBQ * precision)/tokenAQ;
        int spotValueExpected = (_tokenAQty * unitPriceForA)/precision;
        int deltaTokenBQty = getOutGivenIn(_tokenAQty);
        return ((spotValueExpected -  deltaTokenBQty) * precision)/spotValueExpected;
    }

    function slippageInGivenOut(int _tokenBQty) public view returns (int) {
        int precision = getPrecisionValue();
        int tokenAQ = pair.tokenA.tokenQty;
        int tokenBQ = pair.tokenB.tokenQty;
        int unitPriceForB = (tokenAQ * precision) / tokenBQ;
        int spotValueExpected = (_tokenBQty * unitPriceForB) / precision;
        int deltaTokenAQty = getInGivenOut(_tokenBQty);
        return ((deltaTokenAQty - spotValueExpected) * precision)/spotValueExpected;
    }

    function getContractAddress() public view returns(address) {
        return address(this);
    }

    function getTokenPairAddress() public view returns(address, address) {
        return (pair.tokenA.tokenAddress, pair.tokenB.tokenAddress);
    }

    function getFee() public view returns(int) {
        return fee;
    }

    function getFeePrecision() public pure returns (int) {
        return 100;
    }

    function feeForToken(int _tokenQ) public view returns(int) {
        int tokenQ = ((_tokenQ * fee)/2)/getFeePrecision();
        return tokenQ;
    }

    function transferFeeToTreasury(int feeTokenA, int feeTokenB) private {
        int response = transferToken(pair.tokenA.tokenAddress, address(this), treasury, feeTokenA);
        require(response == HederaResponseCodes.SUCCESS, "swapFeeTokenA: Transferring fee as token A to treasuary failed with status code");

        response = transferToken(pair.tokenB.tokenAddress, address(this), treasury, feeTokenB);
        require(response == HederaResponseCodes.SUCCESS, "swapFeeTokenB: Transferring fee as token B to treasuary failed with status code");
    }
}   