// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;
import "../common/IErrors.sol";
import "../common/hedera/HederaTokenService.sol";

import "./IGovernorTransferToken.sol";
import "./GovernorCountingSimpleInternal.sol";

contract GovernorTransferToken is
    IGovernorTransferToken,
    GovernorCountingSimpleInternal
{
    uint256 private constant TRANSFER = 1;
    uint256 private constant ASSOCIATE = 2;
    uint256 private constant HBAR_TRANSFER = 3;

    mapping(uint256 => bytes) proposalsData;

    function createTokenAssociateProposal(
        string memory _title,
        string memory _description,
        string memory _linkToDiscussion,
        address _token,
        address _creator,
        uint256 _nftTokenSerialId
    ) external returns (uint256) {
        return
            _createProposalInternally(
                _title,
                _description,
                _linkToDiscussion,
                _creator,
                _nftTokenSerialId,
                abi.encode(ASSOCIATE, _token)
            );
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
    ) public returns (uint256) {
        require(_amount > 0, "GTT: required positive number");
        bytes memory _data;
        if (_token == address(0)) {
            _data = abi.encode(HBAR_TRANSFER, _to, _amount);
        } else {
            _data = abi.encode(TRANSFER, _to, _token, _amount);
        }
        return
            _createProposalInternally(
                _title,
                _description,
                _linkToDiscussion,
                _creator,
                _nftTokenSerialId,
                _data
            );
    }

    function createHBarTransferProposal(
        string memory _title,
        string memory _description,
        string memory _linkToDiscussion,
        address _to,
        uint256 _amount,
        address _creator,
        uint256 _nftTokenSerialId
    ) external payable returns (uint256) {
        return
            createProposal(
                _title,
                _description,
                _linkToDiscussion,
                _to,
                address(0),
                _amount,
                _creator,
                _nftTokenSerialId
            );
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
        if (operationType == ASSOCIATE) {
            _associate(data);
        } else if (operationType == TRANSFER) {
            _transfer(data);
        } else {
            _transferHbar(data);
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

    function _transferHbar(bytes memory _data) private {
        (, address payable to, uint256 amount) = abi.decode(
            _data,
            (uint256, address, uint256)
        );
        (bool isTransferred, ) = to.call{value: amount}("");
        require(isTransferred, "GTT: Hbar transfer failed");
    }

    function _createProposalInternally(
        string memory _title,
        string memory _description,
        string memory _linkToDiscussion,
        address _creator,
        uint256 _nftTokenSerialId,
        bytes memory _data
    ) private returns (uint256) {
        uint256 proposalId = _createProposal(
            _title,
            _description,
            _linkToDiscussion,
            _creator,
            _data,
            _nftTokenSerialId
        );
        proposalsData[proposalId] = _data;
        return proposalId;
    }
}
