// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;
import "./GovernorCountingSimpleInternal.sol";

contract GovernorTokenCreate is GovernorCountingSimpleInternal {
    using Bits for uint256;
    address treasurer;
    bytes treasurerKeyBytes;
    address admin;
    bytes adminKeyBytes;
    string tokenName;
    string tokenSymbol;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        IERC20 _token,
        address _treasurer,
        bytes memory _treasurerKeyBytes,
        address _admin,
        bytes memory _adminKeyBytes,
        string memory _tokenName,
        string memory _tokenSymbol,
        uint256 _votingDelayValue,
        uint256 _votingPeriodValue
    ) public initializer {
        token = _token;
        precision = 10000000;
        treasurer = _treasurer;
        treasurerKeyBytes = _treasurerKeyBytes;
        admin = _admin;
        adminKeyBytes = _adminKeyBytes;
        tokenName = _tokenName;
        tokenSymbol = _tokenSymbol;

        __Governor_init("HederaGovernor");
        __GovernorSettings_init(
            _votingDelayValue, /* 1 block */
            _votingPeriodValue, /* 1 week */
            0
        );
        __GovernorCountingSimple_init();
    }

    function quorum(uint256)
        public
        pure
        override(IGovernorUpgradeable)
        returns (uint256)
    {
        return 1;
    }

    /**
     * @dev Internal execution mechanism. Can be overridden to implement different execution mechanism
     */
    function _execute(
        uint256, /* proposalId */
        address[] memory,
        uint256[] memory,
        bytes[] memory,
        bytes32 /*descriptionHash*/
    ) internal virtual override {
        createToken();
    }

    function createToken()
        internal
        returns (int256 responseCode, address tokenAddress)
    {
        uint256 supplyKeyType;
        uint256 adminKeyType;

        IHederaTokenService.KeyValue memory supplyKeyValue;
        supplyKeyType = supplyKeyType.setBit(4);
        supplyKeyValue.ed25519 = treasurerKeyBytes;

        IHederaTokenService.KeyValue memory adminKeyValue;
        adminKeyType = adminKeyType.setBit(0);
        adminKeyValue.ed25519 = adminKeyBytes;

        IHederaTokenService.TokenKey[]
            memory keys = new IHederaTokenService.TokenKey[](2);

        keys[0] = IHederaTokenService.TokenKey(supplyKeyType, supplyKeyValue);
        keys[1] = IHederaTokenService.TokenKey(adminKeyType, supplyKeyValue);

        IHederaTokenService.Expiry memory expiry;
        expiry.autoRenewAccount = treasurer;
        expiry.autoRenewPeriod = 8000000;

        IHederaTokenService.HederaToken memory newToken;
        newToken.name = tokenName;
        newToken.symbol = tokenSymbol;
        newToken.treasury = treasurer;
        newToken.expiry = expiry;
        newToken.tokenKeys = keys;

        (responseCode, tokenAddress) = createFungibleToken(
            newToken,
            uint256(0),
            8
        );

        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "Token creation failed"
        );
    }
}