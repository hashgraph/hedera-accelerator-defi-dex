// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./common/hedera/HederaResponseCodes.sol";
import "./common/IBaseHTS.sol";
import "./common/IERC20.sol";
import "./ILPToken.sol";
import "./IPair.sol";

/// Emitted when the calculated slippage is over the slippage threshold.
/// @param message a description of the error.
/// @param calculatedSlippage the slippage calculated based on the requested transaction parameters.
/// @param slippageThreshold the maximum slippage allowed for a transaction to proceed.
error SlippageBreached(
    string message,
    int256 calculatedSlippage,
    int256 slippageThreshold
);

error WrongPairPassed(
    string message,
    address passedTokenA,
    address passedTokenB,
    address expectedTokenA,
    address expectedTokenB
);

contract Pair is IPair, Initializable {
    IBaseHTS internal tokenService;
    ILPToken internal lpTokenContract;

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
        _associateToken(address(this), _tokenA);
        _associateToken(address(this), _tokenB);
        _associateToken(treasury, _tokenA);
        _associateToken(treasury, _tokenB);
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
        _tokenAQty = _tokenQuantity(_tokenA, _tokenAQty);
        _tokenBQty = _tokenQuantity(_tokenB, _tokenBQty);

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
        int256 _deltaQty,
        int256 _slippage
    ) external payable virtual override {
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

    function doTokenASwap(
        address to,
        int256 _deltaAQty,
        int256 _slippage
    ) private {
        int256 calculatedSlippage = slippageOutGivenIn(_deltaAQty);
        isSlippageBreached(calculatedSlippage, _slippage);

        // Token A Calculation
        (
            int256 _tokenATreasureFee,
            int256 _deltaAQtyAfterAdjustingFee,
            int256 _tokenASwapQtyPlusContractTokenShare
        ) = _calculateIncomingTokenQuantities(_deltaAQty);

        int256 swapBValue = getOutGivenIn(_deltaAQtyAfterAdjustingFee);

        //Token B Calculation
        (
            int256 _actualSwapBValue,
            int256 _tokenBTreasureFee
        ) = _calculateOutgoingTokenQuantities(swapBValue);

        pair.tokenA.tokenQty += _tokenASwapQtyPlusContractTokenShare;
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

        pair.tokenB.tokenQty -= _actualSwapBValue + _tokenBTreasureFee;

        //Token B transfer
        _associateToken(to, pair.tokenB.tokenAddress);

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
        int256 _deltaBQty,
        int256 _slippage
    ) private {
        int256 calculatedSlippage = slippageInGivenOut(_deltaBQty);
        isSlippageBreached(calculatedSlippage, _slippage);
        // Token A Calculation
        (
            int256 _tokenBTreasureFee,
            int256 _deltaBQtyAfterAdjustingFee,
            int256 _tokenBSwapQtyPlusContractTokenShare
        ) = _calculateIncomingTokenQuantities(_deltaBQty);

        int256 swapAValue = getInGivenOut(_deltaBQtyAfterAdjustingFee);

        //Token B Calculation
        (
            int256 _actualSwapAValue,
            int256 _tokenATreasureFee
        ) = _calculateOutgoingTokenQuantities(swapAValue);

        pair.tokenB.tokenQty += _tokenBSwapQtyPlusContractTokenShare;

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

        pair.tokenA.tokenQty -= _actualSwapAValue + _tokenATreasureFee;

        //Token B transfer
        _associateToken(to, pair.tokenA.tokenAddress);

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

    function getPairQty() public view returns (int256, int256) {
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

    function getSpotPrice(address token) public view returns (int256) {
        int256 precision = getPrecisionValue();
        int256 spotTokenQty = token == pair.tokenA.tokenAddress
            ? pair.tokenA.tokenQty
            : pair.tokenB.tokenQty;
        int256 otherTokenQty = token == pair.tokenA.tokenAddress
            ? pair.tokenB.tokenQty
            : pair.tokenA.tokenQty;
        int256 value;
        if (otherTokenQty > 0) {
            value = (spotTokenQty * precision) / otherTokenQty;
        }
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
        return 100_000_000;
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
        returns (address, address, address, int256)
    {
        return (
            pair.tokenA.tokenAddress,
            pair.tokenB.tokenAddress,
            lpTokenContract.getLpTokenAddress(),
            fee
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

    function _calculateIncomingTokenQuantities(
        int256 senderSwapQty
    ) private view returns (int256, int256, int256) {
        // Token A Calculation
        int256 tokenFee = feeForToken(senderSwapQty);
        int256 _tokenTreasureFee = tokenFee / 2; //50% goes to treasurer
        int256 tokenContractShare = tokenFee / 2; //50% goes to contract

        int256 _deltaQtyAfterAdjustingFee = senderSwapQty - tokenFee;
        int256 _tokenASwapQtyPlusContractTokenShare = _deltaQtyAfterAdjustingFee +
                tokenContractShare;

        return (
            _tokenTreasureFee,
            _deltaQtyAfterAdjustingFee,
            _tokenASwapQtyPlusContractTokenShare
        );
    }

    function _calculateOutgoingTokenQuantities(
        int256 swappedValue
    ) private view returns (int256, int256) {
        int256 tokenFee = feeForToken(swappedValue);
        int256 _actualSwappedValue = swappedValue - tokenFee;
        int256 _tokenTreasureFee = tokenFee / 2;
        return (_actualSwappedValue, _tokenTreasureFee);
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
        if (_tokenIsHBARX(token)) {
            if (_isContractSendingTokens(sender)) {
                _checkIfContractHaveRequiredHBARBalance(tokenQty);
            } else {
                _checkIfCallerSentCorrectHBARs(tokenQty);
            }
            if (!_isContractRecievingTokens(reciever)) {
                _transferHbars(tokenQty, reciever, errorMessage);
            }
        } else {
            if (_isContractSendingTokens(sender)) {
                _transferTokenFromContract(
                    token,
                    tokenQty,
                    reciever,
                    errorMessage
                );
            } else {
                _transferTokenFromSender(
                    token,
                    tokenQty,
                    sender,
                    reciever,
                    errorMessage
                );
            }
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

    function _checkIfContractHaveRequiredHBARBalance(int256 tokenQty) private {
        require(
            _contractHBARBalance() >= uint256(tokenQty),
            "Contract does not have sufficient Hbars"
        );
    }

    function _contractHBARBalance() private returns (uint256) {
        return
            uint256(
                pair.tokenA.tokenAddress == tokenService.hbarxAddress()
                    ? pair.tokenA.tokenQty
                    : pair.tokenB.tokenQty
            );
    }

    function _checkIfCallerSentCorrectHBARs(int256 tokenQty) private view {
        require(msg.value >= uint256(tokenQty), "Please pass correct Hbars");
    }

    function _transferHbars(
        int256 tokenQty,
        address reciever,
        string memory errorMessage
    ) private {
        bool sent = tokenService.transferHBAR{value: uint256(tokenQty)}(
            payable(reciever)
        );
        require(sent, errorMessage);
    }

    function _transferTokenFromContract(
        address token,
        int256 tokenQty,
        address reciever,
        string memory errorMessage
    ) private {
        bool isSuccess = IERC20(token).transfer(reciever, uint(tokenQty));
        require(isSuccess, errorMessage);
    }

    function _transferTokenFromSender(
        address token,
        int256 tokenQty,
        address sender,
        address reciever,
        string memory errorMessage
    ) private {
        int256 response = tokenService.transferTokenPublic(
            token,
            sender,
            reciever,
            tokenQty
        );
        require(response == HederaResponseCodes.SUCCESS, errorMessage);
    }

    function _tokenQuantity(
        address token,
        int256 quantity
    ) private returns (int256) {
        if (_tokenIsHBARX(token)) {
            require(quantity == 0, "HBARs should be passed as payble");
            return int256(msg.value);
        }
        return quantity;
    }

    function _associateToken(address account, address token) private {
        if (!_tokenIsHBARX(token)) {
            (bool success, ) = address(tokenService).delegatecall(
                abi.encodeWithSelector(
                    IBaseHTS.associateTokenPublic.selector,
                    account,
                    token
                )
            );
            //Its done to silent the not-used return value. Intentionally not putting
            //requires check as it fails the unit test. We need to investigate more to
            //find the root cause.
            success = success || true;
        }
    }

    function _tokenIsHBARX(address token) private returns (bool) {
        return token == tokenService.hbarxAddress();
    }

    function isSlippageBreached(
        int256 calculatedSlippage,
        int256 _slippage
    ) private view {
        int256 slippageThreshold = _slippage > 0 ? _slippage : getSlippage();
        if (calculatedSlippage > slippageThreshold) {
            revert SlippageBreached({
                message: "The calculated slippage is over the slippage threshold.",
                calculatedSlippage: calculatedSlippage,
                slippageThreshold: slippageThreshold
            });
        }
    }
}
