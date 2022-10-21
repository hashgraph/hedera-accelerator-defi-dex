//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./Pair.sol";
import "./IPair.sol";
import "./LPToken.sol";
import "./ILPToken.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract Factory is Initializable {
    bytes32 constant deploymentSalt = 0x00;
    event PairCreated(address indexed _pairAddress, string msg);
    event Initializing(address indexed _pairAddress, string msg);

    IPair [] public allPairs;
    mapping (address => mapping(address => IPair)) pairs;
    IBaseHTS internal tokenService;
    

    function setUpFactory(IBaseHTS _tokenService) public initializer {
        tokenService = _tokenService;      
    }

    function sortTokens(address tokenA, address tokenB) private pure returns (address token0, address token1) {
        require(tokenA != tokenB, "IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "ZERO_ADDRESS");
    }

    function getPair(address _tokenA, address _tokenB) public view returns(address) {
         (address token0, address token1) = sortTokens(_tokenA, _tokenB);
        IPair pair = pairs[token0][token1];
        return address(pair);
    }

    function getPairs() public view returns(IPair [] memory) {
        return allPairs;
    }

    function initializeContract(address fromAccount, address _tokenA, address _tokenB, int _tokenAQty, int _tokenBQty, int fee) external {
        (address token0, address token1) = sortTokens(_tokenA, _tokenB);
        IPair pair = pairs[token0][token1];
        emit Initializing(address(pair), "Pair found for initializing");
        require(address(pair) != address(0), "Pair  not found for initializing");
        pair.initializeContract(fromAccount, _tokenA, _tokenB, _tokenAQty, _tokenBQty, fee);
    }

    function createPair(address _tokenA, address _tokenB) external payable returns(address) {
        (address token0, address token1) = sortTokens(_tokenA, _tokenB);
        IPair pair = pairs[token0][token1];
        if (address(pair) == address(0)) {
            address deployedPair = deployContract();
            IPair newPair = IPair(deployedPair);
            pairs[token0][token1] = newPair;
            allPairs.push(newPair);
            emit PairCreated(deployedPair, "New Pair Created");
            return deployedPair;
        }  
        return address(pair);
    }

    function deployContract() internal returns (address) {
        address deployedContract = address(
            new Pair{salt: deploymentSalt}()
        );
        IPair newPair = IPair(deployedContract);
        address lpTokenDeployed = deployLPContract();
        ILPToken lp = ILPToken(lpTokenDeployed);
        newPair.initialize(tokenService, lp);
        return deployedContract;
    }

    function deployLPContract() internal returns (address) {
        address deployedContract = address(
            new LPToken{salt: deploymentSalt}()
        );
        (bool success, ) = deployedContract.call{value: msg.value}(
            abi.encodeWithSelector(ILPToken.initializeParams.selector, tokenService));
        require(success, "LPToken Initialization fail!");
        return deployedContract;
    }

    function addLiquidity(address fromAccount, address _tokenA, address _tokenB, int _tokenAQty, int _tokenBQty) external {
        (address token0, address token1) = sortTokens(_tokenA, _tokenB);
        IPair pair = pairs[token0][token1];
        require(address(pair) != address(0), " PAIR_ZERO_ADDRESS");
        pair.addLiquidity(fromAccount, _tokenA, _tokenB, _tokenAQty, _tokenBQty);
    }

    function removeLiquidity(address fromAccount, address _tokenA, address _tokenB, int _lpToken) external {
        (address token0, address token1) = sortTokens(_tokenA, _tokenB);
        IPair pair = pairs[token0][token1];
        require(address(pair) != address(0), " PAIR_ZERO_ADDRESS");
        pair.removeLiquidity(fromAccount, _lpToken);
    }

    function swapToken(address to, address _tokenA, address _tokenB, int _deltaAQty, int _deltaBQty) external {
        (address token0, address token1) = sortTokens(_tokenA, _tokenB);
        IPair pair = pairs[token0][token1];
        require(address(pair) != address(0), " PAIR_ZERO_ADDRESS");
        pair.swapToken(to, _tokenA, address(0), _deltaAQty, _deltaBQty);   
    }
}
