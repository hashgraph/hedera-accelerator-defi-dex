// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;
import "./GovernorCountingSimpleInternal.sol";
import "./hedera/HederaTokenService.sol";

contract GovernorTransferToken is GovernorCountingSimpleInternal {
    address transferFromAccount;
    address transferToAccount;
    address tokenToTransfer;
    int256 transferTokenAmount;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        IERC20 _token,
        address _transferFromAccount,
        address _transferToAccount,
        address _tokenToTransfer,
        int256 _transferTokenAmount,
        uint256 _votingDelayValue,
        uint256 _votingPeriodValue,
        IBaseHTS _tokenService
    ) public initializer {
        tokenService = _tokenService;
        token = _token;
        precision = 100000000;
        transferFromAccount = _transferFromAccount;
        transferToAccount = _transferToAccount;
        tokenToTransfer = _tokenToTransfer;
        transferTokenAmount = _transferTokenAmount;
        
        __Governor_init("HederaTransferTokenGovernor");
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
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 description
    ) internal virtual override {
        transferToken();
        super._execute(proposalId,targets, values, calldatas, description);
    }

    function transferToken() internal {
        tokenService.associateTokenPublic(transferToAccount, tokenToTransfer);
        int responseCode = tokenService.transferTokenPublic(
            tokenToTransfer,
            transferFromAccount,
            transferToAccount,
            int64(transferTokenAmount)
        );
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Transfer token failed.");
        }
    }
}
