//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./Pair.sol";
import "./IPair.sol";
import "./LPToken.sol";
import "./ILPToken.sol";
import "./common/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract Factory is Initializable {
    event PairCreated(address indexed _pairAddress, string msg);
    event Initializing(address indexed _pairAddress, string msg);

    address[] public allPairs;
    mapping(address => mapping(address => IPair)) pairs;
    IBaseHTS internal tokenService;
    address private admin;

    function setUpFactory(
        IBaseHTS _tokenService,
        address _admin
    ) public initializer {
        tokenService = _tokenService;
        admin = _admin;
    }

    function hbarxAddress() external returns (address) {
        return tokenService.hbarxAddress();
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

    function getPair(
        address _tokenA,
        address _tokenB
    ) public view returns (address) {
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
        address pairLogic = address(new Pair{salt: deploymentSalt}());
        address pairProxy = deployTransparentProxyContract(
            deploymentSalt,
            pairLogic
        );
        address lpTokenDeployed = deployLPContract(
            deploymentSalt,
            _tokenA,
            _tokenB
        );
        ILPToken lp = ILPToken(lpTokenDeployed);
        IPair newPair = IPair(pairProxy);
        newPair.initialize(tokenService, lp, _tokenA, _tokenB, _treasury, _fee);
        return pairProxy;
    }

    function deployTransparentProxyContract(
        bytes32 deploymentSalt,
        address logic
    ) internal returns (address) {
        bytes memory _data;
        address deployedContract = address(
            new TransparentUpgradeableProxy{salt: deploymentSalt}(
                logic,
                admin,
                _data
            )
        );
        return deployedContract;
    }

    function deployLPContract(
        bytes32 deploymentSalt,
        address _tokenA,
        address _tokenB
    ) internal returns (address) {
        string memory lpTokenSymbol = getLPTokenSymbol(_tokenA, _tokenB);
        string memory lpTokenName = string.concat(
            lpTokenSymbol,
            " LP token name"
        );
        address lpLogic = address(new LPToken{salt: deploymentSalt}());
        address lpProxy = deployTransparentProxyContract(
            deploymentSalt,
            lpLogic
        );
        (bool success, ) = lpProxy.call{value: msg.value}(
            abi.encodeWithSelector(
                ILPToken.initialize.selector,
                tokenService,
                lpTokenName,
                lpTokenSymbol
            )
        );
        require(success, "LPToken Initialization fail!");
        return lpProxy;
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
}
