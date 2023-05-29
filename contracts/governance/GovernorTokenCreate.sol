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
        string memory _tokenSymbol
    ) public returns (uint256) {
        uint256 proposalId = _createProposal(
            title,
            description,
            linkToDiscussion,
            msg.sender,
            bytes("")
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
            tokenService,
            tokenCreateData.tokenName,
            tokenCreateData.tokenSymbol,
            0,
            8
        );

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
        uint256 amount
    ) external returns (int64) {
        TokenCreateData storage tokenCreateData = _proposalData[proposalId];

        require(
            tokenCreateData.newTokenAddress != address(0x0),
            "GovernorTokenCreate: Mint not allowed as token doesn't exist for this proposal."
        );

        require(
            tokenCreateData.treasurer == msg.sender,
            "GovernorTokenCreate: Only treasurer can mint tokens."
        );

        (int256 responseCode, int64 newTotalSupply) = super.mintToken(
            tokenService,
            tokenCreateData.newTokenAddress,
            amount
        );

        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "GovernorTokenCreate: Minting token failed"
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
            "GovernorTokenCreate: Burn not allowed as token doesn't exist for this proposal."
        );

        require(
            tokenCreateData.treasurer == msg.sender,
            "GovernorTokenCreate: Only treasurer can burn tokens."
        );

        (int256 responseCode, int64 newTotalSupply) = super.burnToken(
            tokenService,
            tokenCreateData.newTokenAddress,
            amount
        );

        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "GovernorTokenCreate: Burn token failed"
        );

        return newTotalSupply;
    }

    function transferToken(
        uint256 proposalId,
        address to,
        uint256 amount
    ) external {
        require(
            amount > 0,
            "GovernorTokenCreate: Token quantity to transfer should be greater than zero."
        );
        TokenCreateData storage tokenCreateData = _proposalData[proposalId];
        require(
            tokenCreateData.newTokenAddress != address(0x0),
            "GovernorTokenCreate: Token transfer not allowed as token doesn't exist for this proposal."
        );
        require(
            tokenCreateData.treasurer == msg.sender,
            "GovernorTokenCreate: Only treasurer can transfer tokens."
        );
        uint256 contractBalance = _balanceOf(
            tokenCreateData.newTokenAddress,
            address(this)
        );
        require(
            contractBalance >= amount,
            "GovernorTokenCreate: Contract doesn't have sufficient balance please take treasurer help to mint it."
        );

        int256 responseCode = super._transferToken(
            tokenCreateData.newTokenAddress,
            address(this),
            to,
            amount
        );
        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "GovernorTokenCreate: Token transfer failed."
        );
    }
}
