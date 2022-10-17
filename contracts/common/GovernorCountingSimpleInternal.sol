// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/governance/GovernorUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/IGovernorUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorSettingsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorCountingSimpleUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol";
import "./IERC20.sol";
import "./IBaseHTS.sol";

contract GovernorCountingSimpleInternal is 
                    Initializable, 
                    GovernorUpgradeable, 
                    GovernorSettingsUpgradeable, 
                    GovernorCountingSimpleUpgradeable, 
                    HederaTokenService {
    using Bits for uint;
    uint256 precision;

    IERC20 token;
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
                    uint _votingDelayValue,
                    uint _votingPeriodValue
                  )
        initializer public
    {
        token = _token;
        precision = 10000000;
        treasurer = _treasurer;
        treasurerKeyBytes = _treasurerKeyBytes;
        admin = _admin;
        adminKeyBytes = _adminKeyBytes;
        tokenName = _tokenName;
        tokenSymbol = _tokenSymbol;
        __Governor_init("HederaGovernor");
        __GovernorSettings_init(_votingDelayValue /* 1 block */, _votingPeriodValue /* 1 week */, 0);
        __GovernorCountingSimple_init();
    }

    function _getVotes(
        address account,
        uint256,
        bytes memory /*params*/
    ) internal view virtual override returns (uint256) {
        uint256 share = (token.balanceOf(account) * precision)/token.totalSupply();
        uint256 percentageShare = share / (precision / 100);
        return percentageShare;
    }

    function votingDelay()
        public
        view
        override(IGovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(IGovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function proposalThreshold()
        public
        view
        override(GovernorUpgradeable, GovernorSettingsUpgradeable)
        returns (uint256)
    {
        return super.proposalThreshold();
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
     * @dev See {IGovernor-execute}.
     */
    function execute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public payable virtual returns (uint256) {
        bytes32 descriptionHash = keccak256(bytes(description));
        return execute(targets, values,calldatas, descriptionHash);
    }

    /**
     * @dev See {Governor-_quorumReached}.
     */
    function quorumReached(uint256 proposalId) external view returns (bool) {
        return super._quorumReached(proposalId);
    }

    /**
     * @dev See {Governor-_voteSucceeded}. In this module, the forVotes must be strictly over the againstVotes.
     */
    function voteSucceeded(uint256 proposalId) external view returns (bool) {
        return super._voteSucceeded(proposalId);
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
        // string memory errorMessage = "Governor: call reverted without message";
        // for (uint256 i = 0; i < targets.length; ++i) {
        //     (bool success, bytes memory returndata) = targets[i].call{value: values[i]}(calldatas[i]);
        //     AddressUpgradeable.verifyCallResult(success, returndata, errorMessage);
        // }
        createToken();
    }

    function createToken() internal returns (int responseCode, address tokenAddress) {
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

        (responseCode,  tokenAddress) = createFungibleToken(newToken, uint(0), 8);

        require(responseCode == HederaResponseCodes.SUCCESS, "Token creation failed");
    }
}

library Bits {

    uint constant internal ONE = uint(1);

    // Sets the bit at the given 'index' in 'self' to '1'.
    // Returns the modified value.
    function setBit(uint self, uint8 index) internal pure returns (uint) {
        return self | ONE << index;
    }
}