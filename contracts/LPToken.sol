//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./common/hedera/HederaResponseCodes.sol";
import "./common/IBaseHTS.sol";
import "./common/IERC20.sol";
import "./common/hedera/HederaTokenService.sol";
import "./ILPToken.sol";

contract LPToken is ILPToken, Initializable {
    IBaseHTS tokenService;
    IERC20 lpToken;

    using Bits for uint256;

    event SenderDetail(address indexed _from, string msg);

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

    function initialize(
        IBaseHTS _tokenService,
        string memory tokenName,
        string memory tokenSymbol
    ) external payable override initializer {
        tokenService = _tokenService;
        (, address newToken) = createFungibleTokenPublic(
            0,
            tokenName,
            tokenSymbol
        );
        lpToken = IERC20(newToken);
    }

    function allotLPTokenFor(
        int256 amountA,
        int256 amountB,
        address _toUser
    ) external override returns (int256 responseCode) {
        emit SenderDetail(msg.sender, "allotLPTokenFor");
        require(
            (amountA > 0 && amountB > 0),
            "Please provide positive token counts"
        );
        int256 mintingAmount = sqrt(amountA * amountB);
        require(
            address(lpToken) > address(0x0),
            "Liquidity Token not initialized"
        );
        tokenService.associateTokenPublic(_toUser, address(lpToken));
        (int256 response, ) = tokenService.mintTokenPublic(
            address(lpToken),
            mintingAmount
        );
        require(
            response == HederaResponseCodes.SUCCESS,
            "LP token minting failed."
        );
        bool isTransferSuccessful = lpToken.transfer(
            _toUser,
            uint256(mintingAmount)
        );
        require(
            isTransferSuccessful,
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
        // transfer Lp from users account to contract
        int256 response = tokenService.transferTokenPublic(
            address(lpToken),
            fromUser,
            address(this),
            lpAmount
        );
        require(
            response == HederaResponseCodes.SUCCESS,
            "LPToken: token transfer failed to contract."
        );
        // burn old amount of LP
        (response, ) = tokenService.burnTokenPublic(address(lpToken), lpAmount);
        require(
            response == HederaResponseCodes.SUCCESS,
            "LP token burn failed."
        );
        return HederaResponseCodes.SUCCESS;
    }

    function createFungibleTokenPublic(
        int256 mintingAmount,
        string memory tokenName,
        string memory tokenSymbol
    ) internal returns (int256 responseCode, address tokenAddress) {
        uint256 supplyKeyType;
        IHederaTokenService.KeyValue memory supplyKeyValue;

        supplyKeyType = supplyKeyType.setBit(4);
        supplyKeyValue.delegatableContractId = address(tokenService);

        IHederaTokenService.TokenKey[]
            memory keys = new IHederaTokenService.TokenKey[](1);
        keys[0] = IHederaTokenService.TokenKey(supplyKeyType, supplyKeyValue);

        IHederaTokenService.Expiry memory expiry;
        expiry.autoRenewAccount = address(this);
        expiry.autoRenewPeriod = 8000000;

        IHederaTokenService.HederaToken memory myToken;
        myToken.name = tokenName;
        myToken.symbol = tokenSymbol;
        myToken.treasury = address(this);
        myToken.expiry = expiry;
        myToken.tokenKeys = keys;
        /// @custom:oz-upgrades-unsafe-allow delegatecall
        (bool success, bytes memory result) = address(tokenService)
            .delegatecall(
                abi.encodeWithSelector(
                    IBaseHTS.createFungibleTokenPublic.selector,
                    myToken,
                    uint256(mintingAmount),
                    8
                )
            );

        (responseCode, tokenAddress) = success
            ? abi.decode(result, (int256, address))
            : (int256(HederaResponseCodes.UNKNOWN), address(0x0));

        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "LPToken: Token creation failed."
        );
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

library Bits {
    uint256 internal constant ONE = uint256(1);

    // Sets the bit at the given 'index' in 'self' to '1'.
    // Returns the modified value.
    function setBit(uint256 self, uint8 index) internal pure returns (uint256) {
        return self | (ONE << index);
    }
}
