// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;
import "./GovernorCountingSimpleInternal.sol";

contract GovernorTokenCreate is GovernorCountingSimpleInternal {
    struct TokenCreateData {
        address treasurer;
        string tokenName;
        string tokenSymbol;
        address newTokenAddress;
    }

    mapping(uint256 => TokenCreateData) _proposalData;

    function createProposal(
        string memory title,
        string memory description,
        string memory linkToDiscussion,
        address _treasurer,
        string memory _tokenName,
        string memory _tokenSymbol,
        address creator,
        uint256 nftTokenSerialId
    ) public returns (uint256) {
        uint256 proposalId = _createProposal(
            title,
            description,
            linkToDiscussion,
            creator,
            bytes(""),
            nftTokenSerialId
        );
        _proposalData[proposalId] = TokenCreateData(
            _treasurer,
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

        (responseCode, tokenAddress) = super.createTokenWithContractAsOwner(
            hederaService,
            tokenCreateData.tokenName,
            tokenCreateData.tokenSymbol,
            0,
            8
        );

        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "GTC: Token creation failed."
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
        uint256 amount
    ) external returns (int64) {
        TokenCreateData storage tokenCreateData = _proposalData[proposalId];

        require(
            tokenCreateData.newTokenAddress != address(0x0),
            "GTC: mint, no proposal"
        );

        require(
            tokenCreateData.treasurer == msg.sender,
            "GTC: treasurer can mint"
        );

        (int256 responseCode, int64 newTotalSupply) = super.mintToken(
            hederaService,
            tokenCreateData.newTokenAddress,
            amount
        );

        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "GTC: Minting failed"
        );
        return newTotalSupply;
    }

    function burnToken(
        uint256 proposalId,
        uint256 amount
    ) external returns (int64) {
        TokenCreateData storage tokenCreateData = _proposalData[proposalId];
        require(
            tokenCreateData.newTokenAddress != address(0x0),
            "GTC: burn, no proposal."
        );

        require(
            tokenCreateData.treasurer == msg.sender,
            "GTC: treasurer can burn"
        );

        (int256 responseCode, int64 newTotalSupply) = super.burnToken(
            hederaService,
            tokenCreateData.newTokenAddress,
            amount
        );

        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "GTC: Burn failed"
        );

        return newTotalSupply;
    }

    function transferToken(
        uint256 proposalId,
        address to,
        uint256 amount
    ) external {
        require(amount > 0, "GTC: qty should be > 0");
        TokenCreateData storage tokenCreateData = _proposalData[proposalId];
        require(
            tokenCreateData.newTokenAddress != address(0x0),
            "GTC: transfer not allowed as no token for this proposal"
        );
        require(
            tokenCreateData.treasurer == msg.sender,
            "GTC: treasurer can transfer tokens."
        );
        uint256 contractBalance = _balanceOf(
            tokenCreateData.newTokenAddress,
            address(this)
        );
        require(
            contractBalance >= amount,
            "GTC: Contract doesn't have balance, mint it."
        );

        int256 responseCode = super._transferToken(
            tokenCreateData.newTokenAddress,
            address(this),
            to,
            amount
        );
        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "GTC: Token transfer failed."
        );
    }
}
