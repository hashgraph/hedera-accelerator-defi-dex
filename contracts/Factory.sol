//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./Pair.sol";
import "./LPToken.sol";
import "./ILPToken.sol";
import "./common/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "./Configuration.sol";
import "hardhat/console.sol";

contract Factory is Initializable {
    event PairCreated(address indexed pairAddress);
    event LogicUpdated(
        address indexed oldImplementation,
        address indexed newImplementation,
        string name
    );

    string private constant PAIR = "PairContract";
    string private constant LP_TOKEN = "LpTokenContract";

    address private admin;
    IBaseHTS private service;

    address[] private allPairs;
    mapping(address => mapping(address => mapping(int256 => address)))
        private pairs;

    address private pairLogic;
    address private lpLogic;

    Configuration configuration;

    struct PairDetail {
        address pair;
        address token;
        int256 swappedQty;
        int256 fee;
        int256 slippage;
    }

    modifier ifAdmin() {
        require(msg.sender == admin, "Factory: auth failed");
        _;
    }

    function setUpFactory(
        IBaseHTS _service,
        address _admin,
        Configuration _configuration
    ) public initializer {
        service = _service;
        admin = _admin;
        pairLogic = address(new Pair());
        configuration = _configuration;
        emit LogicUpdated(address(0), pairLogic, PAIR);
        lpLogic = address(new LPToken());
        emit LogicUpdated(address(0), lpLogic, LP_TOKEN);
    }

    function hbarxAddress() external returns (address) {
        return service.hbarxAddress();
    }

    function getPair(
        address _tokenA,
        address _tokenB,
        int256 _fee
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
        int256 _fee
    ) external payable returns (address pair) {
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

    function upgradePairImplementation(address _newImpl) external ifAdmin {
        emit LogicUpdated(pairLogic, _newImpl, PAIR);
        pairLogic = _newImpl;
    }

    function upgradeLpTokenImplementation(address _newImpl) external ifAdmin {
        emit LogicUpdated(lpLogic, _newImpl, LP_TOKEN);
        lpLogic = _newImpl;
    }

    function recommendedPairToSwap(
        address _tokenToSwap,
        address _otherTokenOfPair,
        int256 _qtyToSwap
    ) external view returns (PairDetail memory) {
        uint256[] memory feeItems = configuration.getTransactionsFee();
        (address _token0, address _token1) = sortTokens(
            _tokenToSwap,
            _otherTokenOfPair
        );

        PairDetail[] memory recommendedPairs = qtyPoolResult(
            feeItems,
            _token0,
            _token1,
            _tokenToSwap,
            _qtyToSwap
        );
        return findMaxQtyPool(recommendedPairs);
    }

    function qtyPoolResult(
        uint256[] memory feeItems,
        address _token0,
        address _token1,
        address _tokenToSwap,
        int256 _qtyToSwap
    ) private view returns (PairDetail[] memory) {
        uint256 pairsCount = feeItems.length / 2;
        uint256 count = 0;
        PairDetail[] memory recommendedPairs = new PairDetail[](pairsCount);
        for (uint i = 0; i < feeItems.length; i = i + 2) {
            uint256 value = feeItems[i + 1];
            Pair pair = Pair(pairs[_token0][_token1][int256(value)]);
            if (address(pair) != address(0x0)) {
                int256 _qty;
                address _token;
                int256 _slippage;
                if (_tokenToSwap == _token0) {
                    (, , _qty, ) = pair.getOutGivenIn(_qtyToSwap);
                    _token = _token0;
                    _slippage = pair.slippageOutGivenIn(_qtyToSwap);
                } else {
                    (, _qty, , ) = pair.getInGivenOut(_qtyToSwap);
                    _token = _token1;
                    _slippage = pair.slippageInGivenOut(_qtyToSwap);
                }

                recommendedPairs[count] = PairDetail(
                    address(pair),
                    _token0,
                    _qty,
                    int256(value),
                    _slippage
                );
                count += 1;
            }
        }
        return recommendedPairs;
    }

    function findMaxQtyPool(
        PairDetail[] memory recommendedPairs
    ) private view returns (PairDetail memory) {
        PairDetail memory finalPair = recommendedPairs[0];
        {
            for (uint i = 0; i < recommendedPairs.length; i++) {
                console.logInt(recommendedPairs[i].swappedQty);
                console.logInt(finalPair.swappedQty);
                if (recommendedPairs[i].swappedQty > finalPair.swappedQty) {
                    finalPair = recommendedPairs[i];
                }
            }
        }
        return finalPair;
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
        int256 _fee
    ) private returns (IPair pair) {
        ILPToken _lpContract = _createLpContractInternally(_tokenA, _tokenB);

        pair = IPair(_createProxy(pairLogic));
        pair.initialize(
            service,
            _lpContract,
            _tokenA,
            _tokenB,
            _treasury,
            _fee
        );
    }

    function _createLpContractInternally(
        address _tokenA,
        address _tokenB
    ) private returns (ILPToken lp) {
        string memory lpTokenSymbol = getLPTokenSymbol(_tokenA, _tokenB);
        string memory lpTokenName = string.concat(
            lpTokenSymbol,
            " LP token name"
        );

        lp = ILPToken(_createProxy(lpLogic));
        lp.initialize{value: msg.value}(service, lpTokenName, lpTokenSymbol);
    }

    function _createProxy(address _logic) private returns (address) {
        bytes memory _data;
        return address(new TransparentUpgradeableProxy(_logic, admin, _data));
    }
}
