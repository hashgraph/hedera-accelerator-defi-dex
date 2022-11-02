// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./common/hedera/HederaResponseCodes.sol";
import "./common/IBaseHTS.sol";
import "./ILPToken.sol";
import "./IPair.sol";

contract Pair is IPair, HederaResponseCodes, Initializable {
    IBaseHTS internal tokenService;
    ILPToken internal lpTokenContract;

    struct LiquidityContributor {
        Pair pair;
    }

    address internal creator;

    mapping(address => LiquidityContributor) liquidityContribution;

    Pair pair;

    int256 slippage;

    int256 private fee;

    address private treasury;

    function initialize(IBaseHTS _tokenService, ILPToken _lpTokenContract)
        public
        override
        initializer
    {
        tokenService = _tokenService;
        creator = msg.sender;
        lpTokenContract = _lpTokenContract;
    }

    function getPair() external view override returns (Pair memory) {
        return pair;
    }

    function initializeContract(
        address fromAccount,
        address _tokenA,
        address _tokenB,
        int256 _tokenAQty,
        int256 _tokenBQty,
        int256 _fee,
        address _treasury
    ) external virtual override {
        pair = Pair(Token(_tokenA, _tokenAQty), Token(_tokenB, _tokenBQty));
        liquidityContribution[fromAccount] = LiquidityContributor(pair);

        fee = _fee;
        treasury = _treasury;

        tokenService.associateTokenPublic(address(this), _tokenA);
        tokenService.associateTokenPublic(address(this), _tokenB);

        int256 response = tokenService.transferTokenPublic(
            _tokenA,
            fromAccount,
            address(this),
            _tokenAQty
        );

        require(
            response == HederaResponseCodes.SUCCESS,
            "Creating contract: Transfering token A to contract failed with status code"
        );

        response = tokenService.transferTokenPublic(
            _tokenB,
            fromAccount,
            address(this),
            _tokenBQty
        );
        require(
            response == HederaResponseCodes.SUCCESS,
            "Creating contract: Transfering token B to contract failed with status code"
        );
        lpTokenContract.allotLPTokenFor(_tokenAQty, _tokenBQty, fromAccount);
    }

    function addLiquidity(
        address fromAccount,
        address _tokenA,
        address _tokenB,
        int256 _tokenAQty,
        int256 _tokenBQty
    ) external virtual override {
        pair.tokenA.tokenQty += _tokenAQty;
        pair.tokenB.tokenQty += _tokenBQty;

        tokenService.associateTokenPublic(address(this), _tokenA);
        tokenService.associateTokenPublic(address(this), _tokenB);

        int256 response = tokenService.transferTokenPublic(
            _tokenA,
            fromAccount,
            address(this),
            _tokenAQty
        );
        require(
            response == HederaResponseCodes.SUCCESS,
            "Add liquidity: Transfering token A to contract failed with status code"
        );

        response = tokenService.transferTokenPublic(
            _tokenB,
            fromAccount,
            address(this),
            _tokenBQty
        );
        require(
            response == HederaResponseCodes.SUCCESS,
            "Add liquidity: Transfering token B to contract failed with status code"
        );
        LiquidityContributor memory contributedPair = liquidityContribution[
            fromAccount
        ];
        contributedPair.pair.tokenA.tokenQty += _tokenAQty;
        contributedPair.pair.tokenB.tokenQty += _tokenBQty;
        liquidityContribution[fromAccount] = contributedPair;
        lpTokenContract.allotLPTokenFor(_tokenAQty, _tokenBQty, fromAccount);
    }

    function removeLiquidity(address fromAccount, int256 _lpToken)
        external
        virtual
        override
    {
        require(
            lpTokenContract.lpTokenForUser(fromAccount) > _lpToken,
            "user does not have sufficient lpTokens"
        );
        (int256 _tokenAQty, int256 _tokenBQty) = calculateTokenstoGetBack(
            _lpToken
        );
        //Assumption - toAccount must be associated with tokenA and tokenB other transaction fails.
        int256 response = tokenService.transferTokenPublic(
            pair.tokenA.tokenAddress,
            address(this),
            fromAccount,
            _tokenAQty
        );
        require(
            response == HederaResponseCodes.SUCCESS,
            "Remove liquidity: Transferring token A to contract failed with status code"
        );
        response = tokenService.transferTokenPublic(
            pair.tokenB.tokenAddress,
            address(this),
            fromAccount,
            _tokenBQty
        );
        require(
            response == HederaResponseCodes.SUCCESS,
            "Remove liquidity: Transferring token B to contract failed with status code"
        );
        pair.tokenA.tokenQty -= _tokenAQty;
        pair.tokenB.tokenQty -= _tokenBQty;

        lpTokenContract.removeLPTokenFor(_lpToken, fromAccount);
    }

    function calculateTokenstoGetBack(int256 _lpToken)
        internal
        view
        returns (int256, int256)
    {
        int256 allLPTokens = lpTokenContract.getAllLPTokenCount();

        int256 tokenAQuantity = (_lpToken * pair.tokenA.tokenQty) / allLPTokens;
        int256 tokenBQuantity = (_lpToken * pair.tokenB.tokenQty) / allLPTokens;

        return (tokenAQuantity, tokenBQuantity);
    }

    function swapToken(
        address to,
        address _token,
        int256 _deltaQty
    ) external virtual override {
        require(
            _token == pair.tokenA.tokenAddress ||
                _token == pair.tokenB.tokenAddress,
            "Pls pass correct token to swap."
        );

        if (_token == pair.tokenA.tokenAddress) {
            doTokenASwap(to, _deltaQty);
        } else {
            doTokenBSwap(to, _deltaQty);
        }
    }

    function doTokenASwap(address to, int256 _deltaAQty) private {
        int256 calculatedSlippage = slippageOutGivenIn(_deltaAQty);
        int256 localSlippage = getSlippage();
        require(
            calculatedSlippage <= (localSlippage),
            "Slippage threshold breached."
        );
        // deduct fee from the token A
        int256 feeTokenA = feeForToken(_deltaAQty);
        _deltaAQty = _deltaAQty - (feeTokenA / 2);

        int256 deltaBQty = getOutGivenIn(_deltaAQty);
        pair.tokenA.tokenQty += _deltaAQty;
        int256 feeTokenB = feeForToken(deltaBQty);
        // deduct fee from the token B
        deltaBQty = deltaBQty - (feeTokenB / 2);
        int256 response = tokenService.transferTokenPublic(
            pair.tokenA.tokenAddress,
            to,
            address(this),
            _deltaAQty
        );
        require(
            response == HederaResponseCodes.SUCCESS,
            "swapTokenA: Transferring token A to contract failed with status code"
        );

        pair.tokenB.tokenQty -= deltaBQty;
        tokenService.associateTokenPublic(to, pair.tokenB.tokenAddress);
        response = tokenService.transferTokenPublic(
            pair.tokenB.tokenAddress,
            address(this),
            to,
            deltaBQty
        );
        require(
            response == HederaResponseCodes.SUCCESS,
            "swapTokenA: Transferring token B to contract failed with status code"
        );

        transferFeeToTreasury(feeTokenA / 2, feeTokenB / 2);
    }

    function doTokenBSwap(address to, int256 _deltaBQty) private {
        int256 calculatedSlippage = slippageInGivenOut(_deltaBQty);
        int256 localSlippage = getSlippage();
        require(
            calculatedSlippage <= localSlippage,
            "Slippage threshold breached."
        );
        // deduct fee from the token B
        int256 feeTokenB = feeForToken(_deltaBQty);
        _deltaBQty -= (feeTokenB / 2);
        int256 deltaAQty = getInGivenOut(_deltaBQty);
        pair.tokenB.tokenQty += _deltaBQty;
        int256 feeTokenA = feeForToken(deltaAQty);
        // deduct fee from the token A
        deltaAQty -= (feeTokenA / 2);
        int256 response = tokenService.transferTokenPublic(
            pair.tokenB.tokenAddress,
            to,
            address(this),
            _deltaBQty
        );
        require(
            response == HederaResponseCodes.SUCCESS,
            "swapTokenB: Transferring token B to contract failed with status code"
        );

        pair.tokenA.tokenQty -= deltaAQty;
        tokenService.associateTokenPublic(to, pair.tokenA.tokenAddress);
        response = tokenService.transferTokenPublic(
            pair.tokenA.tokenAddress,
            address(this),
            to,
            deltaAQty
        );
        require(
            response == HederaResponseCodes.SUCCESS,
            "swapTokenB: Transferring token A to contract failed with status code"
        );

        transferFeeToTreasury(feeTokenA / 2, feeTokenB / 2);
    }

    function getPairQty() public view returns (int256, int256) {
        return (pair.tokenA.tokenQty, pair.tokenB.tokenQty);
    }

    function getContributorTokenShare(address fromAccount)
        public
        view
        returns (int256, int256)
    {
        LiquidityContributor
            memory liquidityContributor = liquidityContribution[fromAccount];
        return (
            liquidityContributor.pair.tokenA.tokenQty,
            liquidityContributor.pair.tokenB.tokenQty
        );
    }

    function getSpotPrice() public view returns (int256) {
        int256 precision = getPrecisionValue();
        int256 tokenAQ = pair.tokenA.tokenQty;
        int256 tokenBQ = pair.tokenB.tokenQty;
        int256 value = (tokenAQ * precision) / tokenBQ;
        return value;
    }

    function getInGivenOut(int256 amountTokenB) public view returns (int256) {
        int256 invariantValue = getVariantValue();
        int256 precision = getPrecisionValue();
        int256 tokenAQ = pair.tokenA.tokenQty;
        int256 tokenBQ = pair.tokenB.tokenQty;
        int256 adjustedValue = (invariantValue * precision) /
            (tokenBQ - amountTokenB);
        int256 newValue = adjustedValue / precision;
        int256 amountTokenA = newValue - tokenAQ;
        return amountTokenA;
    }

    function getVariantValue() public view returns (int256) {
        int256 tokenAQ = pair.tokenA.tokenQty;
        int256 tokenBQ = pair.tokenB.tokenQty;
        return tokenAQ * tokenBQ;
    }

    function getPrecisionValue() public pure returns (int256) {
        return 10000000;
    }

    function getOutGivenIn(int256 amountTokenA) public view returns (int256) {
        int256 precision = getPrecisionValue();
        int256 invariantValue = getVariantValue();
        int256 tokenAQ = pair.tokenA.tokenQty;
        int256 tokenBQ = pair.tokenB.tokenQty;
        int256 adjustedValue = (invariantValue * precision) /
            (tokenAQ + amountTokenA);
        int256 newValue = adjustedValue / precision;
        int256 amountTokenB = tokenBQ - newValue;
        return amountTokenB;
    }

    function getSlippage() public view returns (int256) {
        // 0.005 should be default as per requirement.
        return (slippage <= 0) ? int256(50000) : slippage;
    }

    function setSlippage(int256 _slippage) external returns (int256) {
        slippage = _slippage;
        return slippage;
    }

    function slippageOutGivenIn(int256 _tokenAQty)
        public
        view
        returns (int256)
    {
        int256 precision = getPrecisionValue();
        int256 tokenAQ = pair.tokenA.tokenQty;
        int256 tokenBQ = pair.tokenB.tokenQty;
        int256 unitPriceForA = (tokenBQ * precision) / tokenAQ;
        int256 spotValueExpected = (_tokenAQty * unitPriceForA) / precision;
        int256 deltaTokenBQty = getOutGivenIn(_tokenAQty);
        return
            ((spotValueExpected - deltaTokenBQty) * precision) /
            spotValueExpected;
    }

    function slippageInGivenOut(int256 _tokenBQty)
        public
        view
        returns (int256)
    {
        int256 precision = getPrecisionValue();
        int256 tokenAQ = pair.tokenA.tokenQty;
        int256 tokenBQ = pair.tokenB.tokenQty;
        int256 unitPriceForB = (tokenAQ * precision) / tokenBQ;
        int256 spotValueExpected = (_tokenBQty * unitPriceForB) / precision;
        int256 deltaTokenAQty = getInGivenOut(_tokenBQty);
        return
            ((deltaTokenAQty - spotValueExpected) * precision) /
            spotValueExpected;
    }

    function getContractAddress() public view returns (address) {
        return address(this);
    }

    function getTokenPairAddress() public view returns (address, address) {
        return (pair.tokenA.tokenAddress, pair.tokenB.tokenAddress);
    }

    function getFee() public view returns (int256) {
        return fee;
    }

    function getFeePrecision() public pure returns (int256) {
        return 100;
    }

    function feeForToken(int256 _tokenQ) public view returns (int256) {
        int256 tokenQ = ((_tokenQ * fee) / 2) / getFeePrecision();
        return tokenQ;
    }

    function transferFeeToTreasury(int256 feeTokenA, int256 feeTokenB) private {
        int256 response = tokenService.transferTokenPublic(
            pair.tokenA.tokenAddress,
            address(this),
            treasury,
            feeTokenA
        );
        require(
            response == HederaResponseCodes.SUCCESS,
            "swapFeeTokenA: Transferring fee as token A to treasuary failed with status code"
        );

        response = tokenService.transferTokenPublic(
            pair.tokenB.tokenAddress,
            address(this),
            treasury,
            feeTokenB
        );
        require(
            response == HederaResponseCodes.SUCCESS,
            "swapFeeTokenB: Transferring fee as token B to treasuary failed with status code"
        );
    }
}
