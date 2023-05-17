//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./common/hedera/HederaResponseCodes.sol";
import "./common/IBaseHTS.sol";
import "./common/IERC20.sol";
import "./common/TokenOperations.sol";
import "./common/hedera/HederaTokenService.sol";
import "./ILPToken.sol";

contract LPToken is ILPToken, OwnableUpgradeable, TokenOperations {
    IBaseHTS tokenService;
    IERC20 lpToken;

    using Bits for uint256;

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
        uint256 tokenAQuantity,
        uint256 tokenBQuantity
    ) external pure override returns (uint256) {
        return sqrt(tokenAQuantity * tokenBQuantity);
    }

    function initialize(
        IBaseHTS _tokenService,
        address _owner,
        string memory tokenName,
        string memory tokenSymbol
    ) external payable override initializer {
        _transferOwnership(_owner);
        tokenService = _tokenService;
        (int256 responseCode, address newToken) = super
            .createTokenWithContractAsOwner(
                _tokenService,
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
        uint256 amountA,
        uint256 amountB,
        address _toUser
    ) external override onlyOwner returns (int256 responseCode) {
        require(
            (amountA > 0 && amountB > 0),
            "Please provide positive token counts"
        );
        uint256 mintingAmount = this.lpTokenCountForGivenTokensQty(
            amountA,
            amountB
        );
        (responseCode, ) = super.mintToken(
            tokenService,
            address(lpToken),
            int256(mintingAmount)
        );
        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "LP token minting failed."
        );
        responseCode = super._transferToken(
            address(lpToken),
            address(this),
            _toUser,
            int256(mintingAmount)
        );
        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "LPToken: token transfer failed from contract."
        );
        return HederaResponseCodes.SUCCESS;
    }

    function removeLPTokenFor(
        uint256 lpAmount,
        address fromUser
    ) external override onlyOwner returns (int256 responseCode) {
        require((lpAmount > 0), "Please provide token counts");
        require(
            this.lpTokenForUser(fromUser) >= lpAmount,
            "User Does not have lp amount"
        );

        responseCode = _transferToken(
            address(lpToken),
            fromUser,
            address(this),
            int256(lpAmount)
        );

        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "LPToken: token transfer failed to contract."
        );

        // burn old amount of LP
        (responseCode, ) = super.burnToken(
            tokenService,
            address(lpToken),
            int256(lpAmount)
        );
        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "LP token burn failed."
        );
        return HederaResponseCodes.SUCCESS;
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
