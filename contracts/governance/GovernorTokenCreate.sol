// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;
import "./GovernorCountingSimpleInternal.sol";

contract GovernorTokenCreate is GovernorCountingSimpleInternal {
    struct TokenCreateData {
        address treasurer;
        bytes treasurerKeyBytes;
        address admin;
        bytes adminKeyBytes;
        string tokenName;
        string tokenSymbol;
        address newTokenAddress;
    }

    using Bits for uint256;
    mapping(uint256 => TokenCreateData) _proposalData;

    function createProposal(
        string memory title,
        string memory description,
        string memory linkToDiscussion,
        address _treasurer,
        bytes memory _treasurerKeyBytes,
        address _admin,
        bytes memory _adminKeyBytes,
        string memory _tokenName,
        string memory _tokenSymbol
    ) public returns (uint256) {
        uint256 proposalId = _createProposal(
            title,
            description,
            linkToDiscussion,
            msg.sender
        );
        _proposalData[proposalId] = TokenCreateData(
            _treasurer,
            _treasurerKeyBytes,
            _admin,
            _adminKeyBytes,
            _tokenName,
            _tokenSymbol,
            address(0)
        );
        return proposalId;
    }

    /**
     * @dev Internal execution mechanism. Can be overridden to implement different execution mechanism
     */
    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 description
    ) internal virtual override {
        createToken(proposalId);
        super._execute(proposalId, targets, values, calldatas, description);
    }

    function createToken(
        uint256 proposalId
    ) internal returns (int256 responseCode, address tokenAddress) {
        TokenCreateData storage tokenCreateData = _proposalData[proposalId];
        uint256 supplyKeyType;

        IHederaTokenService.KeyValue memory supplyKeyValue;
        supplyKeyType = supplyKeyType.setBit(4);
        supplyKeyValue.contractId = address(this);
        supplyKeyValue.delegatableContractId = address(tokenService);

        IHederaTokenService.TokenKey[]
            memory keys = new IHederaTokenService.TokenKey[](1);
        keys[0] = IHederaTokenService.TokenKey(supplyKeyType, supplyKeyValue);

        IHederaTokenService.Expiry memory expiry;
        expiry.autoRenewAccount = address(this);
        expiry.autoRenewPeriod = 8000000;

        IHederaTokenService.HederaToken memory newToken;
        newToken.name = tokenCreateData.tokenName;
        newToken.symbol = tokenCreateData.tokenSymbol;
        newToken.treasury = address(this);
        newToken.expiry = expiry;
        newToken.tokenKeys = keys;

        /// @custom:oz-upgrades-unsafe-allow delegatecall
        (bool success, bytes memory result) = address(tokenService)
            .delegatecall(
                abi.encodeWithSelector(
                    IBaseHTS.createFungibleTokenPublic.selector,
                    newToken,
                    uint256(0),
                    8
                )
            );

        (responseCode, tokenAddress) = success
            ? abi.decode(result, (int256, address))
            : (int256(HederaResponseCodes.UNKNOWN), address(0x0));

        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "GovernorTokenCreate: Token creation failed."
        );
        tokenCreateData.newTokenAddress = tokenAddress;
    }

    function getTokenAddress(uint256 proposalId) public view returns (address) {
        require(
            state(proposalId) == ProposalState.Executed,
            "Contract not executed yet!"
        );
        TokenCreateData memory tokenCreateData = _proposalData[proposalId];
        return tokenCreateData.newTokenAddress;
    }

    function mintToken(
        uint256 proposalId,
        int256 amount
    ) external returns (int256) {
        require(
            amount >= 0,
            "GovernorTokenCreate: Token quantity to mint should be greater than zero."
        );
        TokenCreateData storage tokenCreateData = _proposalData[proposalId];
        require(
            tokenCreateData.newTokenAddress != address(0x0),
            "GovernorTokenCreate: Mint not allowed as token doesn't exist for this proposal."
        );

        (int256 responseCode, int256 newTotalSupply) = tokenService
            .mintTokenPublic(tokenCreateData.newTokenAddress, amount);

        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "GovernorTokenCreate: Minting token failed"
        );
        return newTotalSupply;
    }

    function burnToken(
        uint256 proposalId,
        int256 amount
    ) external returns (int256) {
        require(
            amount >= 0,
            "GovernorTokenCreate: Token quantity to burn should be greater than zero."
        );
        TokenCreateData storage tokenCreateData = _proposalData[proposalId];
        require(
            tokenCreateData.newTokenAddress != address(0x0),
            "GovernorTokenCreate: Burn not allowed as token doesn't exist for this proposal."
        );

        (int256 responseCode, int256 newTotalSupply) = tokenService
            .burnTokenPublic(tokenCreateData.newTokenAddress, amount);

        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "GovernorTokenCreate: Burn token failed"
        );
        return newTotalSupply;
    }
}
