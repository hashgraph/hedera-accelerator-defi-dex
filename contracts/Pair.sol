// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./common/hedera/HederaResponseCodes.sol";
import "./common/IHederaService.sol";
import "./common/TokenOperations.sol";
import "./common/IERC20.sol";
import "./common/IEvents.sol";
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

/// Emitted when a user passes an incorrect pair.
/// @param message a description of the error.
/// @param passedTokenA The passed A token address.
/// @param passedTokenB The passed B token address.
/// @param expectedTokenA The expected A token address.
/// @param expectedTokenB The expected B token address.
error WrongPairPassed(
    string message,
    address passedTokenA,
    address passedTokenB,
    address expectedTokenA,
    address expectedTokenB
);

/**
 * @title Pair
 *
 * The contract allows to manage a token pair, add and remove liquidity,
 * and perform token swaps.
 */
contract Pair is
    IPair,
    IEvents,
    Initializable,
    TokenOperations,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable
{
    // Hedera service event tag
    string private constant HederaService = "HederaService";
    // Invalid denominator error message
    string private constant INVALID_DENOMINATOR =
        "Pair: trying to divide by zero token quantity";

    // Hedera service
    IHederaService internal hederaService;
    // LP token
    ILPToken internal lpTokenContract;

    // Pair info
    Pair pair;

    // Slippage
    uint256 slippage;

    // Fee
    uint256 private fee;

    // Treasury address
    address private treasury;

    // Configuration contract
    Configuration configuration;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @inheritdoc IPair
    function initialize(
        IHederaService _hederaService,
        ILPToken _lpTokenContract,
        address _tokenA,
        address _tokenB,
        address _treasury,
        uint256 _fee,
        Configuration _configuration
    ) public override initializer {
        __ReentrancyGuard_init();
        __Ownable_init();
        require(_fee > 0, "Pair: Fee should be greater than zero.");
        hederaService = _hederaService;
        lpTokenContract = _lpTokenContract;
        fee = _fee;
        treasury = _treasury;
        configuration = _configuration;
        pair = Pair(Token(_tokenA, uint256(0)), Token(_tokenB, uint256(0)));
        _associateToken(address(this), _tokenA);
        _associateToken(address(this), _tokenB);
        emit LogicUpdated(address(0), address(hederaService), HederaService);
    }

    /// @inheritdoc IPair
    function getPair() external view override returns (Pair memory) {
        return pair;
    }

    /// @inheritdoc IPair
    function addLiquidity(
        address fromAccount,
        address _tokenA,
        address _tokenB,
        uint256 _tokenAQty,
        uint256 _tokenBQty
    ) external payable virtual override nonReentrant {
        _tokenAQty = _tokenQuantity(_tokenA, _tokenAQty);
        _tokenBQty = _tokenQuantity(_tokenB, _tokenBQty);

        uint256 _tokenAQtyBeforeAdding = pair.tokenA.tokenQty;
        uint256 _tokenBQtyBeforeAdding = pair.tokenB.tokenQty;

        if (
            _tokenA == pair.tokenA.tokenAddress &&
            _tokenB == pair.tokenB.tokenAddress
        ) {
            pair.tokenA.tokenQty += _tokenAQty;
            pair.tokenB.tokenQty += _tokenBQty;

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

            lpTokenContract.allotLPTokenFor(
                _tokenAQtyBeforeAdding,
                _tokenBQtyBeforeAdding,
                _tokenAQty,
                _tokenBQty,
                fromAccount
            );
        } else if (
            _tokenA == pair.tokenB.tokenAddress &&
            _tokenB == pair.tokenA.tokenAddress
        ) {
            pair.tokenA.tokenQty += _tokenBQty;
            pair.tokenB.tokenQty += _tokenAQty;

            transferTokensInternally(
                fromAccount,
                address(this),
                _tokenB,
                _tokenA,
                _tokenBQty,
                _tokenAQty,
                "Add liquidity: Transfering token A to contract failed with status code",
                "Add liquidity: Transfering token B to contract failed with status code"
            );

            lpTokenContract.allotLPTokenFor(
                _tokenAQtyBeforeAdding,
                _tokenBQtyBeforeAdding,
                _tokenBQty,
                _tokenAQty,
                fromAccount
            );
        } else {
            revert WrongPairPassed({
                message: "Wrong token pair passed",
                passedTokenA: _tokenA,
                passedTokenB: _tokenB,
                expectedTokenA: pair.tokenA.tokenAddress,
                expectedTokenB: pair.tokenB.tokenAddress
            });
        }
    }

    /// @inheritdoc IPair
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

    /**
     * @dev Returns the pair quantities.
     */
    function getPairQty() public view returns (uint256, uint256) {
        return (pair.tokenA.tokenQty, pair.tokenB.tokenQty);
    }

    /**
     * @dev Returns the pair info.
     */
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

    /**
     * @dev Calculates the current price of a given token relative to another token
     * in a liquidity pair.
     *
     * @param token The token address.
     * @return The calculated spot price.
     */
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

    /**
     * @dev Calculates treasury fees and actual amount of A token to swap.
     *
     * @param amountTokenB The A token amount.
     * @return The treasury fee in terms of B token.
     * @return The swapped amount with a contract share.
     * @return The actual A token amount that will be received.
     * @return The treasury fee in terms of A token.
     */
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
            require(tokenBQ > 0, INVALID_DENOMINATOR);
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

    /**
     * @dev Calculates treasury fees and actual amount of B token to swap.
     *
     * @param amountTokenA The A token amount.
     * @return The treasury fee in terms of A token.
     * @return The swapped amount with a contract share.
     * @return The actual B token amount that will be received.
     * @return The treasury fee in terms of B token.
     */
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
            require(tokenAQ > 0, INVALID_DENOMINATOR);
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

    /**
     * @dev Returns the variant value to track the product of the token quantities
     * in a liquidity pool.
     */
    function getVariantValue() public view returns (uint256) {
        uint256 tokenAQ = pair.tokenA.tokenQty;
        uint256 tokenBQ = pair.tokenB.tokenQty;
        return tokenAQ * tokenBQ;
    }

    /**
     * @dev Returns the precision value.
     */
    function getPrecisionValue() public pure returns (uint256) {
        return 100_000_000;
    }

    /**
     * @dev Returns the slippage value.
     */
    function getSlippage() public view returns (uint256) {
        // 0.005 should be default as per requirement.
        return (slippage <= 0) ? uint256(500000) : slippage;
    }

    /**
     * @dev Calculates a slippage value for the swap.
     *
     * @param _tokenAQty The amount of A token to swap.
     * @return _slippage The calculated slippage value.
     */
    function slippageOutGivenIn(
        uint256 _tokenAQty
    ) public view returns (uint256) {
        uint256 precision = getPrecisionValue();
        uint256 tokenAQ = pair.tokenA.tokenQty;
        uint256 tokenBQ = pair.tokenB.tokenQty;
        require(tokenAQ > 0, INVALID_DENOMINATOR);
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

    /**
     * @dev Calculates a slippage value for the swap.
     *
     * @param _tokenBQty The amount of B token to swap.
     * @return The calculated slippage value.
     */
    function slippageInGivenOut(
        uint256 _tokenBQty
    ) public view returns (uint256) {
        uint256 precision = getPrecisionValue();
        uint256 tokenAQ = pair.tokenA.tokenQty;
        uint256 tokenBQ = pair.tokenB.tokenQty;
        require(tokenBQ > 0, INVALID_DENOMINATOR);
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

    /**
     * @dev Calculates The absolute difference between two values.
     *
     * @param lhs The first value.
     * @param rhs The second value.
     * @return difference The absolute difference between two values.
     */
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

    /**
     * @dev Returns the contract address of the pair.
     */
    function getContractAddress() public view returns (address) {
        return address(this);
    }

    /// @inheritdoc IPair
    function getLpTokenContractAddress()
        external
        view
        override
        returns (address)
    {
        return address(lpTokenContract);
    }

    /**
     * @dev Returns pair related addresses.
     *
     * @return The A token address.
     * @return The B token address.
     * @return The LP token address.
     * @return The pair fee.
     */
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

    /**
     * @dev Returns pair fee amount.
     */
    function getFee() public view returns (uint256) {
        return fee;
    }

    /**
     * @dev Returns fee precision.
     */
    function getFeePrecision() public pure returns (uint256) {
        return 100;
    }

    /**
     * @dev Returns fee for exact token amount.
     *
     * @param _tokenQ The token amount.
     * @return The fee for a token
     */
    function feeForToken(uint256 _tokenQ) public view returns (uint256) {
        uint256 tokenQ = ((_tokenQ * fee) / 2) / getFeePrecision();
        return tokenQ;
    }

    /// @inheritdoc IPair
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

    /// @inheritdoc IPair
    function upgradeHederaService(
        IHederaService newHederaService
    ) external override onlyOwner {
        emit LogicUpdated(
            address(hederaService),
            address(newHederaService),
            HederaService
        );
        hederaService = newHederaService;
        lpTokenContract.upgradeHederaService(newHederaService);
    }

    /// @inheritdoc IPair
    function getHederaServiceVersion()
        external
        view
        override
        returns (IHederaService)
    {
        return hederaService;
    }

    /**
     * @dev Calculates token amounts for removing liquidity.
     *
     * @param _lpToken The LP token amount.
     * @return The amount of A token.
     * @return The amount of B token.
     */
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

    /**
     * @dev Performs A token swap.
     *
     * @param to The receiver address.
     * @param _deltaAQty The swapped amount.
     * @param _slippage The slippage value.
     */
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

    /**
     * @dev Performs B token swap.
     *
     * @param to The receiver address.
     * @param _deltaBQty The swapped amount.
     * @param _slippage The slippage value.
     */
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

    /**
     * @dev Calculates incoming token quantities.
     *
     * @param senderSwapQty The swapped amount.
     * @return The treasury fee.
     * @return The swapped amount after adjusting fee.
     * @return The swapped amount with a contract share.
     */
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

    /**
     * @dev Calculates outgoing token quantities.
     *
     * @param swappedValue The swapped amount.
     * @return The actual swapped amount without fee.
     * @return The treasury fee.
     */
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

    /**
     * @dev Transfers tokens with error handling.
     *
     * @param sender The sender address.
     * @param reciever The reciever address.
     * @param tokenA The A token address.
     * @param tokenB The B token address.
     * @param tokenAQty The A token amount.
     * @param tokenBQty The B token amount.
     * @param errorMessageA The error message to handle A token transfer error.
     * @param errorMessageB The error message to handle B token transfer error.
     */
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

    /**
     * @dev Transfers token with error handling.
     *
     * @param sender The sender address.
     * @param receiver The receiver address.
     * @param token The token address.
     * @param tokenQty The token amount.
     * @param errorMessage The error message to handle transfer error.
     */
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
                hederaService,
                token,
                sender,
                receiver,
                tokenQty
            );
            require(responseCode == HederaResponseCodes.SUCCESS, errorMessage);
        }
    }

    /**
     * @dev Checks if the contract sends tokens.
     *
     * @param sender The current sender.
     * @return The bool flag.
     */
    function _isContractSendingTokens(
        address sender
    ) private view returns (bool) {
        return sender == address(this);
    }

    /**
     * @dev Checks if the contract receives tokens.
     *
     * @param reciever The current receiver.
     * @return The bool flag.
     */
    function _isContractRecievingTokens(
        address reciever
    ) private view returns (bool) {
        return reciever == address(this);
    }

    /**
     * @dev Checks if the contract has required HBAR balance.
     *
     * @param tokenQty The required HBAR amount.
     */
    function _checkIfContractHaveRequiredHBARBalance(
        uint256 tokenQty
    ) private view {
        require(
            _contractHBARBalance() >= tokenQty,
            "Contract does not have sufficient Hbars"
        );
    }

    /**
     * @dev Returns HBAR contract balance.
     *
     * @return The HBAR amount.
     */
    function _contractHBARBalance() private view returns (uint256) {
        return
            _tokenIsHBARX(pair.tokenA.tokenAddress)
                ? pair.tokenA.tokenQty
                : pair.tokenB.tokenQty;
    }

    /**
     * @dev Checks if caller sent correct amount of HBAR.
     *
     * @param tokenQty The HBAR amount.
     */
    function _checkIfCallerSentCorrectHBARs(uint256 tokenQty) private view {
        require(msg.value >= tokenQty, "Please pass correct Hbars");
    }

    /**
     * @dev Handles HBAR transfer.
     *
     * @param tokenQty The HBAR amount to send.
     * @param reciever The reciever address.
     * @param errorMessage The error message on failure.
     */
    function _transferHbars(
        uint256 tokenQty,
        address reciever,
        string memory errorMessage
    ) private {
        bool sent = hederaService.transferHBAR{value: tokenQty}(
            payable(reciever)
        );
        require(sent, errorMessage);
    }

    /**
     * @dev Returns correct token quantity.
     *
     * @param token The token address.
     * @param quantity The passed quantity.
     * @return The token quantity.
     */
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

    /**
     * @dev Associates passed token with the passed account.
     *
     * @param account The account for token association.
     * @param token The token to associate with.
     */
    function _associateToken(address account, address token) private {
        if (!_tokenIsHBARX(token)) {
            _associateToken(hederaService, account, token);
        }
    }

    /**
     * @dev Checks if the passed token is HBARX.
     *
     * @param token The token address.
     * @return The bool flag.
     */
    function _tokenIsHBARX(address token) private view returns (bool) {
        return token == configuration.getHbarxAddress();
    }

    /**
     * @dev Checks if the slippage is breached.
     *
     * @param calculatedSlippage The calculated slippage in terms of passed token amount and price movement.
     * @param _slippage The default slippage value.
     */
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
