//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./common/hedera/HederaResponseCodes.sol";
import "./common/IHederaService.sol";
import "./common/IERC20.sol";
import "./common/IEvents.sol";
import "./common/TokenOperations.sol";
import "./common/hedera/HederaTokenService.sol";
import "./ILPToken.sol";

contract LPToken is IEvents, ILPToken, OwnableUpgradeable, TokenOperations {
    string private constant HederaService = "HederaService";

    IHederaService hederaService;
    IERC20 lpToken;

    function lpTokenForUser(
        address _user
    ) external view override returns (uint256) {
        return lpToken.balanceOf(_user);
    }

    function getLpTokenAddress() external view override returns (address) {
        return address(lpToken);
    }

    function getAllLPTokenCount() external view override returns (uint256) {
        return lpToken.totalSupply();
    }

    function lpTokenCountForGivenTokensQty(
        uint256 tokenAQtyPresentInPool,
        uint256 tokenBQtyPresentInPool,
        uint256 tokenAQuantity,
        uint256 tokenBQuantity
    ) external view override returns (uint256) {
        uint256 _totalSupply = lpToken.totalSupply();
        uint256 liquidity;
        if (_totalSupply == 0) {
            //first time liquidity getting added
            liquidity = sqrt(tokenAQuantity * tokenBQuantity);
        } else {
            require(
                tokenAQtyPresentInPool > 0 && tokenBQtyPresentInPool > 0,
                "Pool should contain tokenA and tokenB quantities greater than zero."
            );
            uint256 tokenALiquidity = (tokenAQuantity * _totalSupply) /
                tokenAQtyPresentInPool;
            uint256 tokenBLiquidity = (tokenBQuantity * _totalSupply) /
                tokenBQtyPresentInPool;
            liquidity = tokenALiquidity > tokenBLiquidity
                ? tokenBLiquidity
                : tokenALiquidity;
        }
        return liquidity;
    }

    function initialize(
        IHederaService _hederaService,
        address _owner,
        string memory tokenName,
        string memory tokenSymbol
    ) external payable override initializer {
        _transferOwnership(_owner);
        hederaService = _hederaService;
        emit LogicUpdated(address(0), address(hederaService), HederaService);
        (int256 responseCode, address newToken) = super
            .createTokenWithContractAsOwner(
                _hederaService,
                tokenName,
                tokenSymbol,
                0,
                8
            );
        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "LPToken: Token creation failed."
        );
        lpToken = IERC20(newToken);
    }

    function allotLPTokenFor(
        uint256 tokenAQtyPresentInPool,
        uint256 tokenBQtyPresentInPool,
        uint256 amountA,
        uint256 amountB,
        address _toUser
    ) external override onlyOwner {
        require(
            (amountA > 0 && amountB > 0),
            "Please provide positive token counts"
        );
        uint256 mintingAmount = this.lpTokenCountForGivenTokensQty(
            tokenAQtyPresentInPool,
            tokenBQtyPresentInPool,
            amountA,
            amountB
        );
        (int256 responseCode, ) = super.mintToken(
            hederaService,
            address(lpToken),
            mintingAmount
        );
        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "LP token minting failed."
        );
        responseCode = super._transferToken(
            address(lpToken),
            address(this),
            _toUser,
            mintingAmount
        );
        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "LPToken: token transfer failed from contract."
        );
    }

    function removeLPTokenFor(
        uint256 lpAmount,
        address fromUser
    ) external override onlyOwner {
        require((lpAmount > 0), "Please provide token counts");
        require(
            this.lpTokenForUser(fromUser) >= lpAmount,
            "User Does not have lp amount"
        );

        int256 responseCode = _transferToken(
            address(lpToken),
            fromUser,
            address(this),
            lpAmount
        );

        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "LPToken: token transfer failed to contract."
        );

        // burn old amount of LP
        (responseCode, ) = super.burnToken(
            hederaService,
            address(lpToken),
            lpAmount
        );
        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "LP token burn failed."
        );
    }

    function upgradeHederaService(
        IHederaService newHederaService
    ) external onlyOwner {
        emit LogicUpdated(
            address(hederaService),
            address(newHederaService),
            HederaService
        );
        hederaService = newHederaService;
    }

    function getHederaServiceVersion() external view returns (IHederaService) {
        return hederaService;
    }

    function sqrt(uint256 value) private pure returns (uint256 output) {
        uint256 modifiedValue = (value + 1) / 2;
        output = value;
        while (modifiedValue < output) {
            output = modifiedValue;
            modifiedValue = (value / modifiedValue + modifiedValue) / 2;
        }
    }
}
