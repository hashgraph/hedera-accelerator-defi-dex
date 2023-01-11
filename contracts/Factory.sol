//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./Pair.sol";
import "./IPair.sol";
import "./LPToken.sol";
import "./ILPToken.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract Factory is Initializable {
    event PairCreated(address indexed _pairAddress, string msg);
    event Initializing(address indexed _pairAddress, string msg);

    address[] public allPairs;
    mapping(address => mapping(address => IPair)) pairs;
    IBaseHTS internal tokenService;

    function setUpFactory(IBaseHTS _tokenService) public initializer {
        tokenService = _tokenService;
    }

    function hbarxAddress() external returns (address) {
        return tokenService.hbarxAddress();
    }

    function sortTokens(address tokenA, address tokenB)
        private
        pure
        returns (address token0, address token1)
    {
        require(tokenA != tokenB, "IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);
        require(token0 != address(0), "ZERO_ADDRESS");
    }

    function getPair(address _tokenA, address _tokenB)
        public
        view
        returns (address)
    {
        (address token0, address token1) = sortTokens(_tokenA, _tokenB);
        IPair pair = pairs[token0][token1];
        return address(pair);
    }

    function getPairs() public view returns (address[] memory) {
        return allPairs;
    }

    function createPair(
        address _tokenA,
        address _tokenB,
        address _treasury,
        int256 _fee
    ) external payable returns (address) {
        (address token0, address token1) = sortTokens(_tokenA, _tokenB);
        IPair pair = pairs[token0][token1];
        if (address(pair) == address(0)) {
            address deployedPair = deployContract(
                token0,
                token1,
                _treasury,
                _fee
            );
            IPair newPair = IPair(deployedPair);
            pairs[token0][token1] = newPair;
            allPairs.push(address(newPair));
            emit PairCreated(deployedPair, "New Pair Created");
            return deployedPair;
        }
        return address(pair);
    }

    function deployContract(
        address _tokenA,
        address _tokenB,
        address _treasury,
        int256 _fee
    ) internal returns (address) {
        bytes32 deploymentSalt = keccak256(abi.encodePacked(_tokenA, _tokenB));
        address deployedContract = address(new Pair{salt: deploymentSalt}());
        IPair newPair = IPair(deployedContract);
        address lpTokenDeployed = deployLPContract(deploymentSalt);
        ILPToken lp = ILPToken(lpTokenDeployed);
        newPair.initialize(tokenService, lp, _tokenA, _tokenB, _treasury, _fee);
        return deployedContract;
    }

    function deployLPContract(bytes32 deploymentSalt) internal returns (address) {
        address deployedContract = address(new LPToken{salt: deploymentSalt}());
        (bool success, ) = deployedContract.call{value: msg.value}(
            abi.encodeWithSelector(ILPToken.initialize.selector, tokenService)
        );
        require(success, "LPToken Initialization fail!");
        return deployedContract;
    }
}
