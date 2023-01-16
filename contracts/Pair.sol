// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./common/hedera/HederaResponseCodes.sol";
import "./common/IBaseHTS.sol";
import "./common/IERC20.sol";
import "./ILPToken.sol";
import "./IPair.sol";

contract Pair is IPair, Initializable {
    IBaseHTS internal tokenService;
    ILPToken internal lpTokenContract;

    struct LiquidityContributor {
        Pair pair;
    }

    Pair pair;

    int256 slippage;

    int256 private fee;

    address private treasury;

    function initialize(
        IBaseHTS _tokenService,
        ILPToken _lpTokenContract,
        address _tokenA,
        address _tokenB,
        address _treasury,
        int256 _fee
    ) public override initializer {
        tokenService = _tokenService;
        lpTokenContract = _lpTokenContract;
        fee = _fee;
        treasury = _treasury;
        pair = Pair(Token(_tokenA, int256(0)), Token(_tokenB, int256(0)));
    }

    function getPair() external view override returns (Pair memory) {
        return pair;
    }

    function addLiquidity(
        address fromAccount,
        address _tokenA,
        address _tokenB,
        int256 _tokenAQty,
        int256 _tokenBQty
    ) external payable virtual override {
        tokenService.associateTokenPublic(address(this), _tokenA);
        tokenService.associateTokenPublic(address(this), _tokenB);
        transferTokensInternally(
            fromAccount,
            address(this),
            _tokenA,
            _tokenB,
            _tokenAQty,
            _tokenBQty,
            "Add liquidity: Transfering token A to contract failed with status code",
            "Add liquidity: Transfering token B to contract failed with status code"
        );
        pair.tokenA.tokenQty += _tokenAQty;
        pair.tokenB.tokenQty += _tokenBQty;
        lpTokenContract.allotLPTokenFor(_tokenAQty, _tokenBQty, fromAccount);
    }

    function removeLiquidity(
        address payable toAccount,
        int256 _lpToken
    ) external virtual override {
        require(
            lpTokenContract.lpTokenForUser(toAccount) >= _lpToken,
            "user does not have sufficient lpTokens"
        );
        (int256 _tokenAQty, int256 _tokenBQty) = calculateTokenstoGetBack(
            _lpToken
        );
        //Assumption - toAccount must be associated with tokenA and tokenB other transaction fails.
        transferTokensInternally(
            address(this),
            toAccount,
            pair.tokenA.tokenAddress,
            pair.tokenB.tokenAddress,
            _tokenAQty,
            _tokenBQty,
            "Remove liquidity: Transferring token A to contract failed with status code",
            "Remove liquidity: Transferring token B to contract failed with status code"
        );
        pair.tokenA.tokenQty -= _tokenAQty;
        pair.tokenB.tokenQty -= _tokenBQty;
        lpTokenContract.removeLPTokenFor(_lpToken, toAccount);
    }

    function calculateTokenstoGetBack(
        int256 _lpToken
    ) internal view returns (int256, int256) {
        int256 allLPTokens = lpTokenContract.getAllLPTokenCount();

        int256 tokenAQuantity = (_lpToken * pair.tokenA.tokenQty) / allLPTokens;
        int256 tokenBQuantity = (_lpToken * pair.tokenB.tokenQty) / allLPTokens;

        return (tokenAQuantity, tokenBQuantity);
    }

    function swapToken(
        address to,
        address _token,
        int256 _deltaQty
    ) external payable virtual override {
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
        transferTokenInternally(
            to,
            address(this),
            pair.tokenA.tokenAddress,
            _deltaAQty,
            "swapTokenA: Transferring token A to contract failed with status code"
        );

        pair.tokenB.tokenQty -= deltaBQty;
        tokenService.associateTokenPublic(to, pair.tokenB.tokenAddress);
        transferTokenInternally(
            address(this),
            to,
            pair.tokenB.tokenAddress,
            deltaBQty,
            "swapTokenA: Transferring token B to user failed with status code"
        );
        // fee transfer
        tokenService.associateTokenPublic(treasury, pair.tokenA.tokenAddress);
        transferTokenInternally(
            to,
            treasury,
            pair.tokenA.tokenAddress,
            feeTokenA / 2,
            "swapTokenAFee: Transferring fee as token A to treasuary failed with status code"
        );
        tokenService.associateTokenPublic(treasury, pair.tokenB.tokenAddress);
        transferTokenInternally(
            address(this),
            treasury,
            pair.tokenB.tokenAddress,
            feeTokenB / 2,
            "swapTokenAFee: Transferring fee as token B to treasuary failed with status code"
        );
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
        transferTokenInternally(
            to,
            address(this),
            pair.tokenB.tokenAddress,
            _deltaBQty,
            "swapTokenB: Transferring token B to contract failed with status code"
        );

        pair.tokenA.tokenQty -= deltaAQty;
        tokenService.associateTokenPublic(to, pair.tokenA.tokenAddress);
        transferTokenInternally(
            address(this),
            to,
            pair.tokenA.tokenAddress,
            deltaAQty,
            "swapTokenB: Transferring token A to user failed with status code"
        );

        // fee transfer
        tokenService.associateTokenPublic(treasury, pair.tokenB.tokenAddress);
        transferTokenInternally(
            to,
            treasury,
            pair.tokenB.tokenAddress,
            feeTokenB / 2,
            "swapTokenBFee: Transferring fee as token B to treasuary failed with status code"
        );
        tokenService.associateTokenPublic(treasury, pair.tokenA.tokenAddress);
        transferTokenInternally(
            address(this),
            treasury,
            pair.tokenA.tokenAddress,
            feeTokenA / 2,
            "swapTokenBFee: Transferring fee as token A to treasuary failed with status code"
        );
    }

    function getPairQty() public view returns (int256, int256) {
        return (pair.tokenA.tokenQty, pair.tokenB.tokenQty);
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
        return 100000000;
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
        return (slippage <= 0) ? int256(500000) : slippage;
    }

    function setSlippage(int256 _slippage) external returns (int256) {
        slippage = _slippage;
        return slippage;
    }

    function slippageOutGivenIn(
        int256 _tokenAQty
    ) public view returns (int256) {
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

    function slippageInGivenOut(
        int256 _tokenBQty
    ) public view returns (int256) {
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

    function getLpTokenContractAddress()
        external
        view
        override
        returns (address)
    {
        return address(lpTokenContract);
    }

    function getTokenPairAddress()
        public
        view
        returns (address, address, address)
    {
        return (
            pair.tokenA.tokenAddress,
            pair.tokenB.tokenAddress,
            lpTokenContract.getLpTokenAddress()
        );
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

    function transferTokensInternally(
        address sender,
        address reciever,
        address tokenA,
        address tokenB,
        int256 tokenAQty,
        int256 tokenBQty,
        string memory errorMessageA,
        string memory errorMessageB
    ) private {
        transferTokenInternally(
            sender,
            reciever,
            tokenA,
            tokenAQty,
            errorMessageA
        );
        transferTokenInternally(
            sender,
            reciever,
            tokenB,
            tokenBQty,
            errorMessageB
        );
    }

    function transferTokenInternally(
        address sender,
        address reciever,
        address token,
        int256 tokenQty,
        string memory errorMessage
    ) private {
        if (token == tokenService.hbarxAddress()) {
            if (sender == address(this)) {
                require(
                    address(this).balance >= uint256(tokenQty),
                    "Contract does not have sufficient Hbars"
                );
            } else {
                require(
                    msg.value >= uint256(tokenQty),
                    "Please pass valid Hbars"
                );
            }
            if (reciever != address(this)) {
                (bool sent, ) = address(tokenService).call{
                    value: uint256(tokenQty)
                }(
                    abi.encodeWithSelector(
                        IBaseHTS.transferHBAR.selector,
                        uint256(tokenQty),
                        payable(reciever)
                    )
                );
                require(sent, errorMessage);
            }
        } else {
            if (sender == address(this)) {
                bool isSuccess = IERC20(token).transfer(
                    reciever,
                    uint(tokenQty)
                );
                require(isSuccess, errorMessage);
            } else {
                int256 response = tokenService.transferTokenPublic(
                    token,
                    sender,
                    reciever,
                    tokenQty
                );
                require(response == HederaResponseCodes.SUCCESS, errorMessage);
            }
        }
    }
}
