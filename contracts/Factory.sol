//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./Pair.sol";
import "./LPToken.sol";
import "./ILPToken.sol";
import "./common/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

contract Factory is Initializable {
    event PairCreated(address indexed _pairAddress, string msg);
    event Initializing(address indexed _pairAddress, string msg);

    address private owner;
    IBaseHTS private service;

    address[] private pairs;
    mapping(address => mapping(address => address)) private pairsMap;

    UpgradeableBeacon private lpBeacon;
    UpgradeableBeacon private pairBeacon;

    function setUpFactory(IBaseHTS _service) public initializer {
        service = _service;
        owner = msg.sender;
    }

    function hbarxAddress() external returns (address) {
        return service.hbarxAddress();
    }

    function getPair(
        address _tokenA,
        address _tokenB
    ) external view returns (address) {
        (address token0, address token1) = sortTokens(_tokenA, _tokenB);
        return pairsMap[token0][token1];
    }

    function getPairs() external view returns (address[] memory) {
        return pairs;
    }

    function createPair(
        address _tokenA,
        address _tokenB,
        address _treasury,
        int256 _fee
    ) external payable returns (address pair) {
        (address _token0, address _token1) = sortTokens(_tokenA, _tokenB);
        pair = pairsMap[_token0][_token1];
        if (pair == address(0)) {
            IPair iPair = _createPairContractInternally(
                _token0,
                _token1,
                _treasury,
                _fee
            );
            pair = address(iPair);
            pairsMap[_token0][_token1] = pair;
            pairs.push(pair);
            emit PairCreated(pair, "New Pair Created");
        }
    }

    // -------------------------------------------------------------------------------------------------//
    // --------------------------------- OWNER BLOCK STARTED -----------------------------------------//
    // -------------------------------------------------------------------------------------------------//

    modifier onlyOwner() {
        require(msg.sender == owner, "Factory: auth failed");
        _;
    }

    function getPairImplementation() external view onlyOwner returns (address) {
        return pairBeacon.implementation();
    }

    function getLpTokenImplementation()
        external
        view
        onlyOwner
        returns (address)
    {
        return lpBeacon.implementation();
    }

    function upgradePairImplementation() external onlyOwner {
        pairBeacon.upgradeTo(address(new Pair()));
    }

    function upgradeLpTokenImplementation() external onlyOwner {
        lpBeacon.upgradeTo(address(new LPToken()));
    }

    // -------------------------------------------------------------------------------------------------//
    // ----------------------------------- OWNER BLOCK ENDED -----------------------------------------//
    // -------------------------------------------------------------------------------------------------//

    // -------------------------------------------------------------------------------------------------//
    // --------------------------------- PRIVATE BLOCK STARTED -----------------------------------------//
    // -------------------------------------------------------------------------------------------------//

    modifier pairBeaconInitOnce() {
        if (address(pairBeacon) == address(0)) {
            pairBeacon = new UpgradeableBeacon(address(new Pair()));
        }
        _;
    }

    modifier lpBeaconInitOnce() {
        if (address(lpBeacon) == address(0)) {
            lpBeacon = new UpgradeableBeacon(address(new LPToken()));
        }
        _;
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
        string memory tokenASymbolWithHypen = string.concat(tokenASymbol, "-");
        return string.concat(tokenASymbolWithHypen, tokenBSymbol);
    }

    function _createPairContractInternally(
        address _tokenA,
        address _tokenB,
        address _treasury,
        int256 _fee
    ) private pairBeaconInitOnce returns (IPair pair) {
        ILPToken _lpContract = _createLpContractInternally(_tokenA, _tokenB);

        pair = IPair(_createProxy(pairBeacon));
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
    ) private lpBeaconInitOnce returns (ILPToken lp) {
        string memory lpTokenSymbol = getLPTokenSymbol(_tokenA, _tokenB);
        string memory lpTokenName = string.concat(
            lpTokenSymbol,
            " LP token name"
        );

        lp = ILPToken(_createProxy(lpBeacon));
        lp.initialize{value: msg.value}(service, lpTokenName, lpTokenSymbol);
    }

    function _createProxy(UpgradeableBeacon beacon) private returns (address) {
        bytes memory _data;
        return address(new BeaconProxy(address(beacon), _data));
    }

    // ------------------------------------------------------------------------------------------------- //
    // ------------------------------------ PRIVATE BLOCK ENDED ---------------------------------------- //
    // ------------------------------------------------------------------------------------------------- //
}
