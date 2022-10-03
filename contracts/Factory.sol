//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./Pair.sol";

contract Factory {
    IPair [] public allPairs;
    mapping (address => mapping(address => IPair)) pairs;
    address [] userList;

    // returns sorted token addresses, used to handle return values from pairs sorted in this order
    function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, "IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "ZERO_ADDRESS");
    }

    function addPair(IPair _pair) public {
         IPair pair = IPair(_pair);
        (address token0, address token1) = sortTokens(pair.getPair().tokenA.tokenAddress, pair.getPair().tokenB.tokenAddress);
        pairs[token0][token1] = pair;
        allPairs.push(_pair);
    }

    function setPairs(IPair [] memory _pairs) public {
        for (uint j = 0; j < _pairs.length; j++) {  //for loop example
            IPair pair = IPair(_pairs[j]);
            (address token0, address token1) = sortTokens(pair.getPair().tokenA.tokenAddress, pair.getPair().tokenB.tokenAddress);
            pairs[token0][token1] = pair;
        }
        allPairs = _pairs;
    }

    function getPairs() public view returns(IPair [] memory) {
        return allPairs;
    }

    function initializeContract(address fromAccount, address _tokenA, address _tokenB, int _tokenAQty, int _tokenBQty) external {
        (address token0, address token1) = sortTokens(_tokenA, _tokenB);
        IPair pair = pairs[token0][token1];
        pair.initializeContract(fromAccount, _tokenA, _tokenB, _tokenAQty, _tokenBQty);
    }

    function addLiquidity(address fromAccount, address _tokenA, address _tokenB, int _tokenAQty, int _tokenBQty) external {
        (address token0, address token1) = sortTokens(_tokenA, _tokenB);
        IPair pair = pairs[token0][token1];
        pair.addLiquidity(fromAccount, _tokenA, _tokenB, _tokenAQty, _tokenBQty);
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


    // TODO:- automatic create pool will be added
    function createPairNew() public returns (address) {
        //TODO: use already created BaseContract
        //TODO: Deploy LPToken Contract
        //TODO: Deploy Pair Contract
        //
        bytes32 deploymentSalt = 0x00;
        address deployedContract = address(
            new Pair{salt: deploymentSalt}()
        );
        IPair newPair = IPair(deployedContract);
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
}