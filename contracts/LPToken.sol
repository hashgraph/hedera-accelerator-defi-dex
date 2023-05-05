//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./common/hedera/HederaResponseCodes.sol";
import "./common/IBaseHTS.sol";
import "./common/IERC20.sol";
import "./common/TokenOperations.sol";
import "./common/hedera/HederaTokenService.sol";
import "./ILPToken.sol";

contract LPToken is ILPToken, Initializable, TokenOperations {
    IBaseHTS tokenService;
    IERC20 lpToken;

    using Bits for uint256;

    function lpTokenForUser(
        address _user
    ) external view override returns (int256) {
        return int256(lpToken.balanceOf(_user));
    }

    function getLpTokenAddress() external view override returns (address) {
        return address(lpToken);
    }

    function getAllLPTokenCount() external view override returns (int256) {
        return int256(lpToken.totalSupply());
    }

    function lpTokenCountForGivenTokensQty(
        int256 tokenAQuantity,
        int256 tokenBQuantity
    ) external pure override returns (int256) {
        return sqrt(tokenAQuantity * tokenBQuantity);
    }

    function initialize(
        IBaseHTS _tokenService,
        string memory tokenName,
        string memory tokenSymbol
    ) external payable override initializer {
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
        int256 amountA,
        int256 amountB,
        address _toUser
    ) external override returns (int256 responseCode) {
        require(
            (amountA > 0 && amountB > 0),
            "Please provide positive token counts"
        );
        int256 mintingAmount = this.lpTokenCountForGivenTokensQty(
            amountA,
            amountB
        );
        require(
            address(lpToken) > address(0x0),
            "Liquidity Token not initialized"
        );
        (responseCode, ) = super.mintToken(
            tokenService,
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
        return HederaResponseCodes.SUCCESS;
    }

    function removeLPTokenFor(
        int256 lpAmount,
        address fromUser
    ) external override returns (int256 responseCode) {
        require((lpAmount > 0), "Please provide token counts");
        require(
            this.lpTokenForUser(fromUser) >= lpAmount,
            "User Does not have lp amount"
        );

        responseCode = _transferToken(
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
            tokenService,
            address(lpToken),
            lpAmount
        );
        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "LP token burn failed."
        );
        return HederaResponseCodes.SUCCESS;
    }

    function sqrt(int256 value) public pure returns (int256 output) {
        int256 modifiedValue = (value + 1) / 2;
        output = value;
        while (modifiedValue < output) {
            output = modifiedValue;
            modifiedValue = (value / modifiedValue + modifiedValue) / 2;
        }
    }
}
