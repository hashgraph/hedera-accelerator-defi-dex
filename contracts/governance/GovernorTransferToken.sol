// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;
import "./GovernorCountingSimpleInternal.sol";
import "../common/hedera/HederaTokenService.sol";

contract GovernorTransferToken is GovernorCountingSimpleInternal {
    struct TokenTransferData {
        address transferFromAccount;
        address transferToAccount;
        address tokenToTransfer;
        int256 transferTokenAmount;
        string title;
        string linkToDiscussion;
    }
    mapping(uint256 => TokenTransferData) _proposalData;

    function createProposal(
        string memory description,
        address _transferFromAccount,
        address _transferToAccount,
        address _tokenToTransfer,
        int256 _transferTokenAmount,
        string memory title,
        string memory linkToDiscussion
    ) public returns (uint256) {
        (
            address[] memory targets,
            uint256[] memory values,
            bytes[] memory calldatas
        ) = mockFunctionCall();
        uint256 proposalId = propose(targets, values, calldatas, description);
        TokenTransferData memory tokenTransferData = TokenTransferData(
            _transferFromAccount,
            _transferToAccount,
            _tokenToTransfer,
            _transferTokenAmount,
            title,
            linkToDiscussion
        );
        _proposalData[proposalId] = tokenTransferData;
        return proposalId;
    }

    function getTokenTransferData(
        uint256 proposalId
    ) external view returns (string memory, string memory) {
        TokenTransferData storage tokenTransferData = _proposalData[proposalId];
        require(
            tokenTransferData.transferFromAccount != address(0),
            "No data available"
        );
        return (tokenTransferData.title, tokenTransferData.linkToDiscussion);
    }

    function quorum(
        uint256
    ) public pure override(IGovernorUpgradeable) returns (uint256) {
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
        transferToken(proposalId);
        super._execute(proposalId, targets, values, calldatas, description);
    }

    function transferToken(uint256 proposalId) internal {
        TokenTransferData storage tokenTransferData = _proposalData[proposalId];
        tokenService.associateTokenPublic(
            tokenTransferData.transferToAccount,
            tokenTransferData.tokenToTransfer
        );
        int responseCode = tokenService.transferTokenPublic(
            tokenTransferData.tokenToTransfer,
            tokenTransferData.transferFromAccount,
            tokenTransferData.transferToAccount,
            int64(tokenTransferData.transferTokenAmount)
        );
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("Transfer token failed.");
        }
    }
}
