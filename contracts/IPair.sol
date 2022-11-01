//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./common/IBaseHTS.sol";
import "./ILPToken.sol";

abstract contract IPair { 

    struct Pair {
        Token tokenA;
        Token tokenB;
    }

    struct Token {
        address tokenAddress;
        int tokenQty;
    }

    function getPair() external virtual returns (Pair memory);
    function initialize(IBaseHTS _tokenService, ILPToken _lpTokenContract) public virtual;
    function initializeContract(address fromAccount, address _tokenA, address _tokenB, int _tokenAQty, int _tokenBQty, int fee, address _treasury) external virtual;
    function addLiquidity(address fromAccount, address _tokenA, address _tokenB, int _tokenAQty, int _tokenBQty) external virtual;
    function removeLiquidity(address fromAccount, int _lpToken) external virtual;
    function swapToken(address to, address _token, int _deltaQty) external virtual;
}