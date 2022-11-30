// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;
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
    address newTokenAddress;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        IERC20 _token,
        uint256 _votingDelayValue,
        uint256 _votingPeriodValue,
        IBaseHTS _tokenService
    ) public initializer {
        tokenService = _tokenService;
        token = _token;
        precision = 100000000;
        __Governor_init("HederaTokenCreateGovernor");
        __GovernorSettings_init(
            _votingDelayValue, /* 1 block */
            _votingPeriodValue, /* 1 week */
            0
        );
        __GovernorCountingSimple_init();
    }

    function proposePublic (
        string memory description,
        address _treasurer,
        bytes memory _treasurerKeyBytes,
        address _admin,
        bytes memory _adminKeyBytes,
        string memory _tokenName,
        string memory _tokenSymbol
    ) public returns (uint256) { 
        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas) = functionsInfo();
        uint256 proposalId = propose(targets, values, calldatas, description);
        TokenCreateData memory tokenCreateData = TokenCreateData( _treasurer, _treasurerKeyBytes, _admin,
                                                        _adminKeyBytes,
                                                        _tokenName,
                                                        _tokenSymbol,
                                                        address(0)
                                                        );
        _proposalData[proposalId] = tokenCreateData;
        return proposalId;
    }

    function cancelProposalSub(
        string memory description
    ) public returns (uint256 proposalId) {
        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas) = functionsInfo();
        bytes32 descriptionHash = keccak256(bytes(description));
        proposalId = hashProposal(targets, values, calldatas, descriptionHash);
        require(proposalCreators[proposalId] != address(0), "Proposal not found");
        require(msg.sender == proposalCreators[proposalId], "Only proposer can cancel the proposal");
        proposalId = super._cancel(targets, values, calldatas, descriptionHash);
        returnGODToken(proposalId);
    }

    function executeSubPublic(
        string memory description
    ) public payable returns (uint256) {
        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas) = functionsInfo();
        bytes32 descriptionHash = keccak256(bytes(description));
        return execute(targets, values, calldatas, descriptionHash);
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
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 description
    ) internal virtual override {
        createToken(proposalId);
        super._execute(proposalId,targets, values, calldatas, description);
    }

    function createToken(uint256 proposalId)
        internal
        returns (int256 responseCode, address tokenAddress)
    {
        TokenCreateData storage tokenCreateData = _proposalData[proposalId];
        uint256 supplyKeyType;
        uint256 adminKeyType;

        IHederaTokenService.KeyValue memory supplyKeyValue;
        supplyKeyType = supplyKeyType.setBit(4);
        supplyKeyValue.ed25519 = tokenCreateData.treasurerKeyBytes;

        IHederaTokenService.KeyValue memory adminKeyValue;
        adminKeyType = adminKeyType.setBit(0);
        adminKeyValue.ed25519 = tokenCreateData.adminKeyBytes;

        IHederaTokenService.TokenKey[]
            memory keys = new IHederaTokenService.TokenKey[](2);

        keys[0] = IHederaTokenService.TokenKey(supplyKeyType, supplyKeyValue);
        keys[1] = IHederaTokenService.TokenKey(adminKeyType, adminKeyValue);

        IHederaTokenService.Expiry memory expiry;
        expiry.autoRenewAccount = tokenCreateData.treasurer;
        expiry.autoRenewPeriod = 8000000;

        IHederaTokenService.HederaToken memory newToken;
        newToken.name = tokenCreateData.tokenName;
        newToken.symbol = tokenCreateData.tokenSymbol;
        newToken.treasury = tokenCreateData.treasurer;
        newToken.expiry = expiry;
        newToken.tokenKeys = keys;

        (bool success, bytes memory result) = address(tokenService).call{
            value: msg.value
        }(
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
            "Token creation failed."
        );
        tokenCreateData.newTokenAddress = tokenAddress;
    }

    function getTokenAddress(uint256 proposalId) public view returns(address) {
        require(state(proposalId) == ProposalState.Executed, "Contract not executed yet!");
        TokenCreateData memory tokenCreateData = _proposalData[proposalId];
        return tokenCreateData.newTokenAddress;
    }
}
