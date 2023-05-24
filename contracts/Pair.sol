// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./common/hedera/HederaResponseCodes.sol";
import "./common/IBaseHTS.sol";
import "./common/TokenOperations.sol";
import "./common/IERC20.sol";
import "./ILPToken.sol";
import "./IPair.sol";
import "./Configuration.sol";

/// Emitted when the calculated slippage is over the slippage threshold.
/// @param message a description of the error.
/// @param calculatedSlippage the slippage calculated based on the requested transaction parameters.
/// @param slippageThreshold the maximum slippage allowed for a transaction to proceed.
error SlippageBreached(
    string message,
    uint256 calculatedSlippage,
    uint256 slippageThreshold
);

error WrongPairPassed(
    string message,
    address passedTokenA,
    address passedTokenB,
    address expectedTokenA,
    address expectedTokenB
);

contract Pair is
    IPair,
    Initializable,
    TokenOperations,
    ReentrancyGuardUpgradeable
{
    IBaseHTS internal tokenService;
    ILPToken internal lpTokenContract;

    Pair pair;

    uint256 slippage;

    uint256 private fee;

    address private treasury;

    Configuration configuration;

    function initialize(
        IBaseHTS _tokenService,
        ILPToken _lpTokenContract,
        address _tokenA,
        address _tokenB,
        address _treasury,
        uint256 _fee,
        Configuration _configuration
    ) public override initializer {
        __ReentrancyGuard_init();
        require(_fee > 0, "Pair: Fee should be greater than zero.");
        tokenService = _tokenService;
        lpTokenContract = _lpTokenContract;
        fee = _fee;
        treasury = _treasury;
        configuration = _configuration;
        pair = Pair(Token(_tokenA, uint256(0)), Token(_tokenB, uint256(0)));
        _associateToken(address(this), _tokenA);
        _associateToken(address(this), _tokenB);
    }

    function getPair() external view override returns (Pair memory) {
        return pair;
    }

    function addLiquidity(
        address fromAccount,
        address _tokenA,
        address _tokenB,
        uint256 _tokenAQty,
        uint256 _tokenBQty
    ) external payable virtual override nonReentrant {
        _tokenAQty = _tokenQuantity(_tokenA, _tokenAQty);
        _tokenBQty = _tokenQuantity(_tokenB, _tokenBQty);

        if (
            _tokenA == pair.tokenA.tokenAddress &&
            _tokenB == pair.tokenB.tokenAddress
        ) {
            pair.tokenA.tokenQty += _tokenAQty;
            pair.tokenB.tokenQty += _tokenBQty;
        } else if (
            _tokenA == pair.tokenB.tokenAddress &&
            _tokenB == pair.tokenA.tokenAddress
        ) {
            pair.tokenB.tokenQty += _tokenAQty;
            pair.tokenA.tokenQty += _tokenBQty;
        } else {
            revert WrongPairPassed({
                message: "Wrong token pair passed",
                passedTokenA: _tokenA,
                passedTokenB: _tokenB,
                expectedTokenA: pair.tokenA.tokenAddress,
                expectedTokenB: pair.tokenB.tokenAddress
            });
        }

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

        lpTokenContract.allotLPTokenFor(_tokenAQty, _tokenBQty, fromAccount);
    }

    function removeLiquidity(
        address payable toAccount,
        uint256 _lpToken
    ) external virtual override nonReentrant {
        require(
            lpTokenContract.lpTokenForUser(toAccount) >= _lpToken,
            "user does not have sufficient lpTokens"
        );
        (uint256 _tokenAQty, uint256 _tokenBQty) = calculateTokenstoGetBack(
            _lpToken
        );
        pair.tokenA.tokenQty -= _tokenAQty;
        pair.tokenB.tokenQty -= _tokenBQty;
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
        lpTokenContract.removeLPTokenFor(_lpToken, toAccount);
    }

    function getPairQty() public view returns (uint256, uint256) {
        return (pair.tokenA.tokenQty, pair.tokenB.tokenQty);
    }

    function getPairInfo()
        public
        view
        returns (Pair memory _pair, Amount memory _amount)
    {
        _pair = pair;
        _amount = Amount(
            getSpotPrice(pair.tokenA.tokenAddress),
            getSpotPrice(pair.tokenB.tokenAddress),
            getPrecisionValue(),
            getFeePrecision(),
            fee
        );
    }

    function getSpotPrice(address token) public view returns (uint256) {
        uint256 precision = getPrecisionValue();
        uint256 spotTokenQty = token == pair.tokenA.tokenAddress
            ? pair.tokenA.tokenQty
            : pair.tokenB.tokenQty;
        uint256 otherTokenQty = token == pair.tokenA.tokenAddress
            ? pair.tokenB.tokenQty
            : pair.tokenA.tokenQty;
        uint256 value;
        if (otherTokenQty > 0) {
            value = (spotTokenQty * precision) / otherTokenQty;
        }
        return value;
    }

    function getInGivenOut(
        uint256 amountTokenB
    ) public view returns (uint256, uint256, uint256, uint256) {
        (
            uint256 _tokenBTreasureFee,
            uint256 _deltaBQtyAfterAdjustingFee,
            uint256 _tokenBSwapQtyPlusContractTokenShare
        ) = _calculateIncomingTokenQuantities(amountTokenB);

        uint256 amountTokenA;
        {
            uint256 invariantValue = getVariantValue();
            uint256 precision = getPrecisionValue();
            uint256 tokenAQ = pair.tokenA.tokenQty;
            uint256 tokenBQ = pair.tokenB.tokenQty +
                _deltaBQtyAfterAdjustingFee;
            uint256 adjustedValue = (invariantValue * precision) / (tokenBQ);
            uint256 newValue = adjustedValue / precision;
            amountTokenA = getAbsoluteDifference(newValue, tokenAQ);
        }

        (
            uint256 _actualSwapAValue,
            uint256 _tokenATreasureFee
        ) = _calculateOutgoingTokenQuantities(amountTokenA);

        return (
            _tokenBTreasureFee,
            _tokenBSwapQtyPlusContractTokenShare,
            _actualSwapAValue,
            _tokenATreasureFee
        );
    }

    function getOutGivenIn(
        uint256 amountTokenA
    ) public view returns (uint256, uint256, uint256, uint256) {
        // Token A Calculation
        (
            uint256 _tokenATreasureFee,
            uint256 _deltaAQtyAfterAdjustingFee,
            uint256 _tokenASwapQtyPlusContractTokenShare
        ) = _calculateIncomingTokenQuantities(amountTokenA);

        uint256 amountTokenB;
        //Scoped variable to avoid stack too deep
        {
            uint256 precision = getPrecisionValue();
            uint256 invariantValue = getVariantValue();
            uint256 tokenAQ = pair.tokenA.tokenQty +
                _deltaAQtyAfterAdjustingFee;
            uint256 tokenBQ = pair.tokenB.tokenQty;
            uint256 adjustedValue = (invariantValue * precision) / (tokenAQ);
            uint256 newValue = adjustedValue / precision;
            amountTokenB = getAbsoluteDifference(tokenBQ, newValue);
        }

        //Token B Calculation
        (
            uint256 _actualSwapBValue,
            uint256 _tokenBTreasureFee
        ) = _calculateOutgoingTokenQuantities(amountTokenB);

        return (
            _tokenATreasureFee,
            _tokenASwapQtyPlusContractTokenShare,
            _actualSwapBValue,
            _tokenBTreasureFee
        );
    }

    function getVariantValue() public view returns (uint256) {
        uint256 tokenAQ = pair.tokenA.tokenQty;
        uint256 tokenBQ = pair.tokenB.tokenQty;
        return tokenAQ * tokenBQ;
    }

    function getPrecisionValue() public pure returns (uint256) {
        return 100_000_000;
    }

    function getSlippage() public view returns (uint256) {
        // 0.005 should be default as per requirement.
        return (slippage <= 0) ? uint256(500000) : slippage;
    }

    function setSlippage(uint256 _slippage) external returns (uint256) {
        slippage = _slippage;
        return slippage;
    }

    function slippageOutGivenIn(
        uint256 _tokenAQty
    ) public view returns (uint256) {
        uint256 precision = getPrecisionValue();
        uint256 tokenAQ = pair.tokenA.tokenQty;
        uint256 tokenBQ = pair.tokenB.tokenQty;
        uint256 unitPriceForA = (tokenBQ * precision) / tokenAQ;
        uint256 spotValueExpected = (_tokenAQty * unitPriceForA) / precision;

        (
            ,
            ,
            uint256 _actualSwapBValue,
            uint256 _tokenBTreasureFee
        ) = getOutGivenIn(_tokenAQty);

        uint256 finalDeltaBQty = (_actualSwapBValue + _tokenBTreasureFee);

        uint256 priceMovement = getAbsoluteDifference(
            finalDeltaBQty,
            spotValueExpected
        );

        uint256 calculatedSlippage = (priceMovement * precision) /
            spotValueExpected;

        return calculatedSlippage;
    }

    function slippageInGivenOut(
        uint256 _tokenBQty
    ) public view returns (uint256) {
        uint256 precision = getPrecisionValue();
        uint256 tokenAQ = pair.tokenA.tokenQty;
        uint256 tokenBQ = pair.tokenB.tokenQty;
        uint256 unitPriceForB = (tokenAQ * precision) / tokenBQ;
        uint256 spotValueExpected = (_tokenBQty * unitPriceForB) / precision;

        (
            ,
            ,
            uint256 _actualSwapAValue,
            uint256 _tokenATreasureFee
        ) = getInGivenOut(_tokenBQty);

        uint256 finalDeltaAQty = (_actualSwapAValue + _tokenATreasureFee);

        uint256 priceMovement = getAbsoluteDifference(
            finalDeltaAQty,
            spotValueExpected
        );

        uint256 calculatedSlippage = (priceMovement * precision) /
            spotValueExpected;

        return calculatedSlippage;
    }

    function getAbsoluteDifference(
        uint256 lhs,
        uint256 rhs
    ) internal pure returns (uint256 difference) {
        if (lhs > rhs) {
            difference = lhs - rhs;
        } else {
            difference = rhs - lhs;
        }
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
        returns (address, address, address, uint256)
    {
        return (
            pair.tokenA.tokenAddress,
            pair.tokenB.tokenAddress,
            lpTokenContract.getLpTokenAddress(),
            fee
        );
    }

    function getFee() public view returns (uint256) {
        return fee;
    }

    function getFeePrecision() public pure returns (uint256) {
        return 100;
    }

    function feeForToken(uint256 _tokenQ) public view returns (uint256) {
        uint256 tokenQ = ((_tokenQ * fee) / 2) / getFeePrecision();
        return tokenQ;
    }

    function swapToken(
        address to,
        address _token,
        uint256 _deltaQty,
        uint256 _slippage
    ) external payable virtual override nonReentrant {
        require(
            _token == pair.tokenA.tokenAddress ||
                _token == pair.tokenB.tokenAddress,
            "Pls pass correct token to swap."
        );
        _deltaQty = _tokenQuantity(_token, _deltaQty);
        if (_token == pair.tokenA.tokenAddress) {
            doTokenASwap(to, _deltaQty, _slippage);
        } else {
            doTokenBSwap(to, _deltaQty, _slippage);
        }
    }

    function calculateTokenstoGetBack(
        uint256 _lpToken
    ) internal view returns (uint256, uint256) {
        uint256 allLPTokens = lpTokenContract.getAllLPTokenCount();

        uint256 tokenAQuantity = (_lpToken * pair.tokenA.tokenQty) /
            allLPTokens;
        uint256 tokenBQuantity = (_lpToken * pair.tokenB.tokenQty) /
            allLPTokens;

        return (tokenAQuantity, tokenBQuantity);
    }

    function doTokenASwap(
        address to,
        uint256 _deltaAQty,
        uint256 _slippage
    ) private {
        uint256 calculatedSlippage = slippageOutGivenIn(_deltaAQty);
        isSlippageBreached(calculatedSlippage, _slippage);

        (
            uint256 _tokenATreasureFee,
            uint256 _tokenASwapQtyPlusContractTokenShare,
            uint256 _actualSwapBValue,
            uint256 _tokenBTreasureFee
        ) = getOutGivenIn(_deltaAQty);

        pair.tokenA.tokenQty += _tokenASwapQtyPlusContractTokenShare;
        pair.tokenB.tokenQty -= _actualSwapBValue + _tokenBTreasureFee;

        //Token A transfer
        transferTokenInternally(
            to,
            address(this),
            pair.tokenA.tokenAddress,
            _tokenASwapQtyPlusContractTokenShare,
            "swapTokenA: Transferring token A to contract failed with status code"
        );

        // token A fee transfer
        transferTokenInternally(
            to,
            treasury,
            pair.tokenA.tokenAddress,
            _tokenATreasureFee,
            "swapTokenAFee: Transferring fee as token A to treasuary failed with status code"
        );

        //Token B transfer
        transferTokenInternally(
            address(this),
            to,
            pair.tokenB.tokenAddress,
            _actualSwapBValue,
            "swapTokenA: Transferring token B to user failed with status code"
        );

        //token B fee transfer
        transferTokenInternally(
            address(this),
            treasury,
            pair.tokenB.tokenAddress,
            _tokenBTreasureFee,
            "swapTokenBFee: Transferring fee as token B to treasuary failed with status code"
        );
    }

    function doTokenBSwap(
        address to,
        uint256 _deltaBQty,
        uint256 _slippage
    ) private {
        uint256 calculatedSlippage = slippageInGivenOut(_deltaBQty);
        isSlippageBreached(calculatedSlippage, _slippage);

        (
            uint256 _tokenBTreasureFee,
            uint256 _tokenBSwapQtyPlusContractTokenShare,
            uint256 _actualSwapAValue,
            uint256 _tokenATreasureFee
        ) = getInGivenOut(_deltaBQty);

        //Token B Calculation

        pair.tokenB.tokenQty += _tokenBSwapQtyPlusContractTokenShare;
        pair.tokenA.tokenQty -= _actualSwapAValue + _tokenATreasureFee;

        //Token A transfer
        transferTokenInternally(
            to,
            address(this),
            pair.tokenB.tokenAddress,
            _tokenBSwapQtyPlusContractTokenShare,
            "swapTokenB: Transferring token B to contract failed with status code"
        );

        // token A fee transfer
        transferTokenInternally(
            to,
            treasury,
            pair.tokenB.tokenAddress,
            _tokenBTreasureFee,
            "swapTokenBFee: Transferring fee as token B to treasuary failed with status code"
        );

        //Token B transfer
        transferTokenInternally(
            address(this),
            to,
            pair.tokenA.tokenAddress,
            _actualSwapAValue,
            "swapTokenB: Transferring token A to user failed with status code"
        );

        //token B fee transfer
        transferTokenInternally(
            address(this),
            treasury,
            pair.tokenA.tokenAddress,
            _tokenATreasureFee,
            "swapTokenBFee: Transferring fee as token A to treasuary failed with status code"
        );
    }

    function _calculateIncomingTokenQuantities(
        uint256 senderSwapQty
    ) private view returns (uint256, uint256, uint256) {
        // Token A Calculation
        uint256 tokenFee = feeForToken(senderSwapQty);
        uint256 _tokenTreasureFee = tokenFee / 2; //50% goes to treasurer
        uint256 tokenContractShare = tokenFee / 2; //50% goes to contract

        uint256 _deltaQtyAfterAdjustingFee = getAbsoluteDifference(
            senderSwapQty,
            tokenFee
        );
        uint256 _tokenASwapQtyPlusContractTokenShare = _deltaQtyAfterAdjustingFee +
                tokenContractShare;

        return (
            _tokenTreasureFee,
            _deltaQtyAfterAdjustingFee,
            _tokenASwapQtyPlusContractTokenShare
        );
    }

    function _calculateOutgoingTokenQuantities(
        uint256 swappedValue
    ) private view returns (uint256, uint256) {
        uint256 tokenFee = feeForToken(swappedValue);
        uint256 _actualSwappedValue = getAbsoluteDifference(
            swappedValue,
            tokenFee
        );
        uint256 _tokenTreasureFee = tokenFee / 2;
        return (_actualSwappedValue, _tokenTreasureFee);
    }

    function transferTokensInternally(
        address sender,
        address reciever,
        address tokenA,
        address tokenB,
        uint256 tokenAQty,
        uint256 tokenBQty,
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
        address receiver,
        address token,
        uint256 tokenQty,
        string memory errorMessage
    ) private {
        if (_tokenIsHBARX(token)) {
            if (_isContractSendingTokens(sender)) {
                _checkIfContractHaveRequiredHBARBalance(tokenQty);
            } else {
                _checkIfCallerSentCorrectHBARs(tokenQty);
            }
            if (!_isContractRecievingTokens(receiver)) {
                _transferHbars(tokenQty, receiver, errorMessage);
            }
        } else {
            int256 responseCode = _transferToken(
                token,
                sender,
                receiver,
                tokenQty
            );
            require(responseCode == HederaResponseCodes.SUCCESS, errorMessage);
        }
    }

    function _isContractSendingTokens(
        address sender
    ) private view returns (bool) {
        return sender == address(this);
    }

    function _isContractRecievingTokens(
        address reciever
    ) private view returns (bool) {
        return reciever == address(this);
    }

    function _checkIfContractHaveRequiredHBARBalance(
        uint256 tokenQty
    ) private view {
        require(
            _contractHBARBalance() >= tokenQty,
            "Contract does not have sufficient Hbars"
        );
    }

    function _contractHBARBalance() private view returns (uint256) {
        return
            _tokenIsHBARX(pair.tokenA.tokenAddress)
                ? pair.tokenA.tokenQty
                : pair.tokenB.tokenQty;
    }

    function _checkIfCallerSentCorrectHBARs(uint256 tokenQty) private view {
        require(msg.value >= tokenQty, "Please pass correct Hbars");
    }

    function _transferHbars(
        uint256 tokenQty,
        address reciever,
        string memory errorMessage
    ) private {
        bool sent = tokenService.transferHBAR{value: tokenQty}(
            payable(reciever)
        );
        require(sent, errorMessage);
    }

    function _tokenQuantity(
        address token,
        uint256 quantity
    ) private returns (uint256) {
        if (_tokenIsHBARX(token)) {
            require(quantity == 0, "HBARs should be passed as payble");
            return uint256(msg.value);
        }
        return quantity;
    }

    function _associateToken(address account, address token) private {
        if (!_tokenIsHBARX(token)) {
            _associateToken(tokenService, account, token);
        }
    }

    function _tokenIsHBARX(address token) private view returns (bool) {
        return token == configuration.getHbarxAddress();
    }

    function isSlippageBreached(
        uint256 calculatedSlippage,
        uint256 _slippage
    ) private view {
        uint256 slippageThreshold = _slippage > 0 ? _slippage : getSlippage();

        if (calculatedSlippage > slippageThreshold) {
            revert SlippageBreached({
                message: "The calculated slippage is over the slippage threshold.",
                calculatedSlippage: calculatedSlippage,
                slippageThreshold: slippageThreshold
            });
        }
    }
}
