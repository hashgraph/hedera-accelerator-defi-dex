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
    uint256 private constant TXN_TYPE_TRANSFER = 1;
    uint256 private constant TXN_TYPE_TOKEN_ASSOCIATE = 2;

    mapping(uint256 => bytes) proposalsData;

    function createTokenAssociateProposal(
        string memory _title,
        string memory _description,
        string memory _linkToDiscussion,
        address _token,
        address _creator,
        uint256 _nftTokenSerialId
    ) external returns (uint256) {
        bytes memory data = abi.encode(
            TXN_TYPE_TOKEN_ASSOCIATE, // operationType
            _token // token
        );
        uint256 proposalId = _createProposal(
            _title,
            _description,
            _linkToDiscussion,
            _creator,
            data,
            _nftTokenSerialId
        );
        proposalsData[proposalId] = data;
        return proposalId;
    }

    function createProposal(
        string memory _title,
        string memory _description,
        string memory _linkToDiscussion,
        address _to,
        address _token,
        uint256 _amount,
        address _creator,
        uint256 _nftTokenSerialId
    ) external returns (uint256) {
        require(_amount > 0, "GTT: required positive number");
        bytes memory data = abi.encode(
            TXN_TYPE_TRANSFER, // operationType
            _to, // toAddress
            _token, // token
            _amount // amount
        );
        uint256 proposalId = _createProposal(
            _title,
            _description,
            _linkToDiscussion,
            _creator,
            data,
            _nftTokenSerialId
        );
        proposalsData[proposalId] = data;
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
        _executeOperation(proposalId);
        super._execute(proposalId, targets, values, calldatas, description);
    }

    function _executeOperation(uint256 proposalId) private {
        bytes memory data = proposalsData[proposalId];
        uint256 operationType = abi.decode(data, (uint256));
        if (operationType == TXN_TYPE_TOKEN_ASSOCIATE) {
            _associate(data);
        } else if (operationType == TXN_TYPE_TRANSFER) {
            _transfer(data);
        } else {
            revert("GTT: unknown operation");
        }
    }

    function _associate(bytes memory _data) private {
        (, address token) = abi.decode(_data, (uint256, address));
        _associateTokenInternally(token);
    }

    function _transfer(bytes memory _data) private {
        (, address to, address token, uint256 amount) = abi.decode(
            _data,
            (uint256, address, address, uint256)
        );
        int256 code = _transferToken(token, address(this), to, amount);
        require(code == HederaResponseCodes.SUCCESS, "GTT: transfer failed");
    }
}
