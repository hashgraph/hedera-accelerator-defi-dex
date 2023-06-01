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

contract Factory is IEvents, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    struct PairDetail {
        address pair;
        address token;
        uint256 swappedQty;
        uint256 fee;
        uint256 slippage;
    }

    event PairCreated(address indexed pairAddress);

    string private constant PAIR = "PairContract";
    string private constant LP_TOKEN = "LpTokenContract";

    IHederaService private hederaService;
    address private proxyAdmin;

    address private lpLogic;
    address private pairLogic;

    Configuration configuration;

    address[] private allPairs;
    mapping(address => mapping(address => mapping(uint256 => address)))
        private pairs;

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
    }

    function getPair(
        address _tokenA,
        address _tokenB,
        uint256 _fee
    ) external view returns (address) {
        (address token0, address token1) = sortTokens(_tokenA, _tokenB);
        return pairs[token0][token1][_fee];
    }

    function getPairs() external view returns (address[] memory) {
        return allPairs;
    }

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

    function upgradePairImplementation(address _newImpl) external onlyOwner {
        emit LogicUpdated(pairLogic, _newImpl, PAIR);
        pairLogic = _newImpl;
    }

    function upgradeLpTokenImplementation(address _newImpl) external onlyOwner {
        emit LogicUpdated(lpLogic, _newImpl, LP_TOKEN);
        lpLogic = _newImpl;
    }

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

    function upgradeHederaService(
        IHederaService newHederaService
    ) external onlyOwner {
        hederaService = newHederaService;
        for (uint i = 0; i < allPairs.length; i++) {
            IPair pair = IPair(allPairs[i]);
            pair.upgradeHederaService(newHederaService);
        }
    }

    function getHederaServiceVersion() external view returns (IHederaService) {
        return hederaService;
    }

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
                if (_tokenToSwap == _token0) {
                    (, , _qty, ) = pair.getOutGivenIn(_qtyToSwap);
                    _token = _token1;
                    _slippage = pair.slippageOutGivenIn(_qtyToSwap);
                } else {
                    (, _qty, , ) = pair.getInGivenOut(_qtyToSwap);
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

    function getLPTokenSymbol(
        address _tokenA,
        address _tokenB
    ) private returns (string memory) {
        string memory tokenASymbol = IERC20(_tokenA).symbol();
        string memory tokenBSymbol = IERC20(_tokenB).symbol();
        return string.concat(tokenASymbol, "-", tokenBSymbol);
    }

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

    function _createProxy(address _logic) private returns (address) {
        bytes memory _data;
        return
            address(new TransparentUpgradeableProxy(_logic, proxyAdmin, _data));
    }
}
