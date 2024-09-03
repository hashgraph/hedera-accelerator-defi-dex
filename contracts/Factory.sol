//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./Pair.sol";
import "./ILPToken.sol";
import "./Configuration.sol";

import "./common/IERC20.sol";
import "./common/IEvents.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

/**
 * @title Factory
 *
 * The contract allows to create pairs and manage implementations of the Pair,
 * LP token and Hedera Service contracts.
 */
contract Factory is IEvents, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    // Pair Detail
    struct PairDetail {
        address pair;
        address token;
        uint256 swappedQty;
        uint256 fee;
        uint256 slippage;
    }

    /**
     * @notice PairCreated event.
     * @dev Emitted when user creates a new pair.
     *
     * @param pairAddress The created pair address.
     */
    event PairCreated(address indexed pairAddress);

    // Pair event tag
    string private constant PAIR = "PairContract";
    // LP Token event tag
    string private constant LP_TOKEN = "LpTokenContract";
    // Hedera Service event tag
    string private constant HederaService = "HederaService";

    // Hedera Service
    IHederaService private hederaService;

    // Proxy admin
    address private proxyAdmin;

    // LP token implementation contract
    address private lpLogic;

    // Pair implementation contract
    address private pairLogic;

    // Current Fee configuration
    Configuration configuration;

    // All token pairs
    address[] private allPairs;

    // Token0 => Token1 => Fee => Pair address
    mapping(address => mapping(address => mapping(uint256 => address)))
        private pairs;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the factory with the required parameters.
     *
     * @param _hederaService The address of the Hedera service.
     * @param _proxyAdmin The address of the proxy admin.
     * @param _pairLogic The address of the pair implementation contract.
     * @param _lpLogic The address of the LP token implementation contract.
     * @param _configuration The contract configuration.
     */
    function setUpFactory(
        IHederaService _hederaService,
        address _proxyAdmin,
        address _pairLogic,
        address _lpLogic,
        Configuration _configuration
    ) public initializer {
        __ReentrancyGuard_init();
        _transferOwnership(_proxyAdmin);
        hederaService = _hederaService;
        proxyAdmin = _proxyAdmin;
        pairLogic = _pairLogic;
        lpLogic = _lpLogic;
        configuration = _configuration;
        emit LogicUpdated(address(0), pairLogic, PAIR);
        emit LogicUpdated(address(0), lpLogic, LP_TOKEN);
        emit LogicUpdated(address(0), address(hederaService), HederaService);
    }

    /**
     * @dev Returns the pair address according to the input tokens.
     *
     * @param _tokenA The address of the A token.
     * @param _tokenB The address of the B token.
     * @param _fee The pair fee.
     * @return The pair address.
     */
    function getPair(
        address _tokenA,
        address _tokenB,
        uint256 _fee
    ) external view returns (address) {
        (address token0, address token1) = sortTokens(_tokenA, _tokenB);
        return pairs[token0][token1][_fee];
    }

    /**
     * @dev Returns all existing pair addresses.
     *
     * @return The pair addresses.
     */
    function getPairs() external view returns (address[] memory) {
        return allPairs;
    }

    /**
     * @dev Creates a new pair.
     *
     * @param _tokenA The address of the A token.
     * @param _tokenB The address of the B token.
     * @param _treasury The treasury address.
     * @param _fee The pair fee.
     * @return pair The created pair address.
     */
    function createPair(
        address _tokenA,
        address _tokenB,
        address _treasury,
        uint256 _fee
    ) external payable nonReentrant returns (address pair) {
        (address _token0, address _token1) = sortTokens(_tokenA, _tokenB);
        pair = pairs[_token0][_token1][_fee];
        if (pair == address(0)) {
            IPair iPair = _createPairContractInternally(
                _token0,
                _token1,
                _treasury,
                _fee
            );
            pair = address(iPair);
            pairs[_token0][_token1][_fee] = pair;
            allPairs.push(pair);
            emit PairCreated(pair);
        }
    }

    /**
     * @dev Upgrades the pair implementation.
     *
     * @param _newImpl The address of the new implementation.
     */
    function upgradePairImplementation(address _newImpl) external onlyOwner {
        emit LogicUpdated(pairLogic, _newImpl, PAIR);
        pairLogic = _newImpl;
    }

    /**
     * @dev Upgrades the LP token implementation.
     *
     * @param _newImpl The address of the new implementation.
     */
    function upgradeLpTokenImplementation(address _newImpl) external onlyOwner {
        emit LogicUpdated(lpLogic, _newImpl, LP_TOKEN);
        lpLogic = _newImpl;
    }

    /**
     * @dev Upgrades the Hedera service implementation.
     *
     * @param newHederaService The address of the new implementation.
     */
    function upgradeHederaService(
        IHederaService newHederaService
    ) external onlyOwner {
        emit LogicUpdated(
            address(hederaService),
            address(newHederaService),
            HederaService
        );
        hederaService = newHederaService;
        for (uint i = 0; i < allPairs.length; i++) {
            IPair pair = IPair(allPairs[i]);
            pair.upgradeHederaService(newHederaService);
        }
    }

    /**
     * @dev Returns the Hedera service version.
     *
     * @return The address of the Hedera service.
     */
    function getHederaServiceVersion() external view returns (IHederaService) {
        return hederaService;
    }

    /**
     * @dev Returns the .
     *
     * @param _tokenToSwap The address of the token to swap.
     * @param _otherTokenOfPair The address of the token to receive.
     * @param _qtyToSwap The amount to swap.
     * @return The address of the .
     * @return The address of the .
     * @return The .
     * @return The .
     * @return The .
     */
    function recommendedPairToSwap(
        address _tokenToSwap,
        address _otherTokenOfPair,
        uint256 _qtyToSwap
    ) external view returns (address, address, uint256, uint256, uint256) {
        uint256[] memory fees = configuration.getTransactionsFee();
        (address _token0, address _token1) = sortTokens(
            _tokenToSwap,
            _otherTokenOfPair
        );

        PairDetail memory maxQtyPair = findMaxQtyPool(
            fees,
            _token0,
            _token1,
            _tokenToSwap,
            _qtyToSwap
        );

        return (
            maxQtyPair.pair,
            maxQtyPair.token,
            maxQtyPair.swappedQty,
            maxQtyPair.fee,
            maxQtyPair.slippage
        );
    }

    /**
     * @dev Designed to identify the most favorable pair for swapping
     * a given amount of a token within a DEX.
     *
     * @param fees The array of fee values associated with different liquidity pools.
     * @param _token0 The address of the token to swap.
     * @param _token1 The address of the token to swap.
     * @param _tokenToSwap The address of the token to swap.
     * @param _qtyToSwap The amount to swap.
     * @return The PairDetail struct info.
     */
    function findMaxQtyPool(
        uint256[] memory fees,
        address _token0,
        address _token1,
        address _tokenToSwap,
        uint256 _qtyToSwap
    ) private view returns (PairDetail memory) {
        PairDetail memory maxQtyPair;
        for (uint i = 0; i < fees.length; i = i + 2) {
            uint256 value = fees[i + 1];
            Pair pair = Pair(pairs[_token0][_token1][value]);
            if (address(pair) != address(0x0)) {
                uint256 _qty;
                address _token;
                uint256 _slippage;
                // Determine token to swap
                if (_tokenToSwap == _token0) {
                    (, , _qty, ) = pair.getOutGivenIn(_qtyToSwap);
                    _token = _token1;
                    _slippage = pair.slippageOutGivenIn(_qtyToSwap);
                } else {
                    (, , _qty, ) = pair.getInGivenOut(_qtyToSwap);
                    _token = _token0;
                    _slippage = pair.slippageInGivenOut(_qtyToSwap);
                }

                if (_qty > maxQtyPair.swappedQty) {
                    maxQtyPair = PairDetail(
                        address(pair),
                        _token,
                        _qty,
                        value,
                        _slippage
                    );
                }
            }
        }
        return maxQtyPair;
    }

    /**
     * @dev Mathematically sorts two token addresses for structuring pair.
     *
     * @param tokenA The A token address.
     * @param tokenB The B token address.
     * @return token0 The smaller token address.
     * @return token1 The larger token address.
     */
    function sortTokens(
        address tokenA,
        address tokenB
    ) private pure returns (address token0, address token1) {
        require(tokenA != tokenB, "IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);
        require(token0 != address(0), "ZERO_ADDRESS");
    }

    /**
     * @dev Builds LP token symbol.
     *
     * @param _tokenA The A token address.
     * @param _tokenB The B token address.
     * @return The LP token sybmol.
     */
    function getLPTokenSymbol(
        address _tokenA,
        address _tokenB
    ) private returns (string memory) {
        string memory tokenASymbol = IERC20(_tokenA).symbol();
        string memory tokenBSymbol = IERC20(_tokenB).symbol();
        return string.concat(tokenASymbol, "-", tokenBSymbol);
    }

    /**
     * @dev Deploys the pair contract.
     *
     * @param _tokenA The A token address.
     * @param _tokenB The B token address.
     * @param _treasury The treasury address.
     * @param _fee The pair fee.
     * @return pair The address of the deployd pair.
     */
    function _createPairContractInternally(
        address _tokenA,
        address _tokenB,
        address _treasury,
        uint256 _fee
    ) private returns (IPair pair) {
        pair = IPair(_createProxy(pairLogic));

        ILPToken _lpContract = _createLpContractInternally(
            _tokenA,
            _tokenB,
            address(pair)
        );

        pair.initialize(
            hederaService,
            _lpContract,
            _tokenA,
            _tokenB,
            _treasury,
            _fee,
            configuration
        );
    }

    /**
     * @dev Deploys the LP token contract.
     *
     * @param _tokenA The A token address.
     * @param _tokenB The B token address.
     * @param _owner The initial contract owner.
     * @return lp The address of the deployd LP token.
     */
    function _createLpContractInternally(
        address _tokenA,
        address _tokenB,
        address _owner
    ) private returns (ILPToken lp) {
        string memory lpTokenSymbol = getLPTokenSymbol(_tokenA, _tokenB);
        string memory lpTokenName = string.concat(
            lpTokenSymbol,
            " LP token name"
        );

        lp = ILPToken(_createProxy(lpLogic));
        lp.initialize{value: msg.value}(
            hederaService,
            _owner,
            lpTokenName,
            lpTokenSymbol
        );
    }

    /**
     * @dev Deploys the Transparent proxy for the input implementation.
     *
     * @param _logic The logic contract address.
     * @return The address of the deployd proxy.
     */
    function _createProxy(address _logic) private returns (address) {
        bytes memory _data;
        return
            address(new TransparentUpgradeableProxy(_logic, proxyAdmin, _data));
    }
}
