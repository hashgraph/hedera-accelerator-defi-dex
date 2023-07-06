// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;
import "./GovernorCountingSimpleInternal.sol";
import "../common/hedera/HederaTokenService.sol";
import "../common/IErrors.sol";
import "./IGovernorTransferToken.sol";

contract GovernorTransferToken is
    IGovernorTransferToken,
    GovernorCountingSimpleInternal
{
    struct TokenTransferData {
        address transferFromAccount;
        address transferToAccount;
        address tokenToTransfer;
        uint256 transferTokenAmount;
    }
    mapping(uint256 => TokenTransferData) _proposalData;

    function createProposal(
        string memory title,
        string memory description,
        string memory linkToDiscussion,
        address _transferFromAccount,
        address _transferToAccount,
        address _tokenToTransfer,
        uint256 _transferTokenAmount,
        address creator,
        uint256 nftTokenSerialId
    ) external returns (uint256) {
        if (_transferTokenAmount <= 0) {
            revert InvalidInput(
                "GovernorTransferToken: Token transfer amount must be a positive number"
            );
        }
        TokenTransferData memory tokenTransferData = TokenTransferData(
            _transferFromAccount,
            _transferToAccount,
            _tokenToTransfer,
            _transferTokenAmount
        );
        uint256 proposalId = _createProposal(
            title,
            description,
            linkToDiscussion,
            creator,
            abi.encode(tokenTransferData),
            nftTokenSerialId
        );
        _proposalData[proposalId] = tokenTransferData;
        return proposalId;
    }

    function upgradeHederaService(
        IHederaService newHederaService
    )
        external
        override(GovernorCountingSimpleInternal, IGovernorTransferToken)
        onlyOwner
    {
        hederaService = newHederaService;
    }

    function getHederaServiceVersion()
        external
        view
        override(GovernorCountingSimpleInternal, IGovernorTransferToken)
        returns (IHederaService)
    {
        return hederaService;
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
        transferToken(proposalId);
        super._execute(proposalId, targets, values, calldatas, description);
    }

    function transferToken(uint256 proposalId) internal {
        TokenTransferData storage tokenTransferData = _proposalData[proposalId];
        _associateToken(
            hederaService,
            tokenTransferData.transferToAccount,
            tokenTransferData.tokenToTransfer
        );
        int responseCode = _transferToken(
            tokenTransferData.tokenToTransfer,
            tokenTransferData.transferFromAccount,
            tokenTransferData.transferToAccount,
            tokenTransferData.transferTokenAmount
        );
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("GovernorTransferToken: transfer token failed.");
        }
    }
}
