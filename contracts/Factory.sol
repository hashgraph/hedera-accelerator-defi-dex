//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./Pair.sol";
import "./IPair.sol";
import "./LPToken.sol";
import "./ILPToken.sol";

contract Factory {
    IPair [] public allPairs;
    mapping (address => mapping(address => IPair)) pairs;
    IBaseHTS internal tokenService;
    ILPToken lpToken;
    IPair tempPair;
    event PairCreated(address indexed _pairAddress, string msg);
    event Initializing(address indexed _pairAddress, string msg);

    // returns sorted token addresses, used to handle return values from pairs sorted in this order
    function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, "IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "ZERO_ADDRESS");
    }

    function setUpFactory(IBaseHTS _tokenService) public {
        tokenService = _tokenService;      
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
            address deployedPair = createPairNew();
            IPair newPair = IPair(deployedPair);
            pairs[token0][token1] = newPair;
            allPairs.push(newPair);
            tempPair = newPair;
            emit PairCreated(deployedPair, "New Pair Created");
            return deployedPair;
        }  
        return address(pair);
    }

    function createPairNew() internal returns (address) {
        bytes32 deploymentSalt = 0x00;
        address deployedContract = address(
            new Pair{salt: deploymentSalt}()
        );
        IPair newPair = IPair(deployedContract);
        address lpTokenDeployed = createLPContract();
        ILPToken lp = ILPToken(lpTokenDeployed);
        newPair.initialize(tokenService, lp);
        return deployedContract;
    }

    function createLPContract() internal returns (address) {
        bytes32 deploymentSalt = 0x00;
        address deployedContract = address(
            new LPToken{salt: deploymentSalt}()
        );
        (bool success, ) = deployedContract.call{value: msg.value}(
            abi.encodeWithSelector(ILPToken.initializeParams.selector, tokenService));
        require(success, "LPToken Initialization fail!");
        lpToken = ILPToken(deployedContract);
        return deployedContract;
    }

    function getContractAddress(address owner_) public view returns (address) {
        bytes32 deploymentSalt = 0x00;
        return
            address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                address(this),
                                deploymentSalt,
                                keccak256(
                                    abi.encodePacked(
                                        type(Pair).creationCode,
                                        abi.encode(owner_)
                                    )
                                )
                            )
                        )
                    )
                )
            );
    }


     function addLiquidity(address fromAccount, address _tokenA, address _tokenB, int _tokenAQty, int _tokenBQty) external {
        (address token0, address token1) = sortTokens(_tokenA, _tokenB);
        IPair pair = pairs[token0][token1];
        if (address(pair) != address(0)) {
            pair.addLiquidity(fromAccount, _tokenA, _tokenB, _tokenAQty, _tokenBQty);
        }  
    }

    function removeLiquidity(address fromAccount, address _tokenA, address _tokenB, int _lpToken) external {
        (address token0, address token1) = sortTokens(_tokenA, _tokenB);
        IPair pair = pairs[token0][token1];
        require(token0 != address(0), " PAIR_ZERO_ADDRESS");
        pair.removeLiquidity(fromAccount, _lpToken);
    }

    function swapToken(address to, address _tokenA, address _tokenB, int _deltaAQty, int _deltaBQty) external {
        (address token0, address token1) = sortTokens(_tokenA, _tokenB);
        IPair pair = pairs[token0][token1];
        pair.swapToken(to, _tokenA, address(0), _deltaAQty, _deltaBQty);   
    }
}
