//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./Pair.sol";
import "./LPToken.sol";
import "./ILPToken.sol";
import "./common/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableMapUpgradeable.sol";

contract Factory is Initializable {
    using EnumerableMapUpgradeable for EnumerableMapUpgradeable.UintToUintMap;
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
    mapping(address => mapping(address => address)) private pairs;

    address private pairLogic;
    address private lpLogic;

    EnumerableMapUpgradeable.UintToUintMap private feeMap;

    modifier ifAdmin() {
        require(msg.sender == admin, "Factory: auth failed");
        _;
    }

    function setUpFactory(
        IBaseHTS _service,
        address _admin
    ) public initializer {
        service = _service;
        admin = _admin;
        pairLogic = address(new Pair());
        emit LogicUpdated(address(0), pairLogic, PAIR);
        lpLogic = address(new LPToken());
        emit LogicUpdated(address(0), lpLogic, LP_TOKEN);
        populateFeeMap();
    }

    function hbarxAddress() external returns (address) {
        return service.hbarxAddress();
    }

    function getPair(
        address _tokenA,
        address _tokenB
    ) external view returns (address) {
        (address token0, address token1) = sortTokens(_tokenA, _tokenB);
        return pairs[token0][token1];
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
        pair = pairs[_token0][_token1];
        if (pair == address(0)) {
            IPair iPair = _createPairContractInternally(
                _token0,
                _token1,
                _treasury,
                _fee
            );
            pair = address(iPair);
            pairs[_token0][_token1] = pair;
            allPairs.push(pair);
            emit PairCreated(pair);
        }
    }

    function populateFeeMap() private {
        setTransactionFee(1, 5);
        setTransactionFee(2, 30);
        setTransactionFee(3, 10);
    }

    function setTransactionFee(uint256 key, uint256 value) public {
        feeMap.set(key, value);
    }

    function getTransactionsFee()
        external
        view
        returns (uint256[] memory feeItems)
    {
        uint256 count = feeMap.length();
        feeItems = new uint256[](count * 2);
        for (uint i = 0; i < count; i++) {
            (uint256 key, uint256 value) = feeMap.at(i);
            feeItems[i * 2] = key;
            feeItems[i * 2 + 1] = value;
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
