// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;
import "../common/IErrors.sol";
import "../common/hedera/HederaTokenService.sol";
import "./GovernorCountingSimpleInternal.sol";

contract GovernorTransferToken is GovernorCountingSimpleInternal {
    uint256 private constant TRANSFER = 1;
    uint256 private constant ASSOCIATE = 2;
    uint256 private constant HBAR_TRANSFER = 3;

    event NFTSerialIdBlockStatus(
        uint256 proposalId,
        uint256 nftSerialId,
        bool isBlocked
    );

    error NFTSerialIdAlreadyBlockedByProposal(
        string message,
        uint256 proposalId,
        uint256 nftSerialId
    );

    mapping(uint256 => uint256) private proposalBlockedNFTSerialIds; //ndftSerialId => Proposal ids

    function createTokenAssociateProposal(
        string memory _title,
        string memory _description,
        string memory _linkToDiscussion,
        address _token,
        uint256 _nftTokenSerialId
    ) external returns (uint256) {
        return
            _createProposalInternally(
                _title,
                _description,
                _linkToDiscussion,
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
        uint256 _nftTokenSerialId
    ) public returns (uint256) {
        require(_amount > 0, "GTT: required positive number");
        require(
            !(token == _token && _amount == _nftTokenSerialId),
            "GTT: NFT GOD token and token to transfer can't be same."
        );
        bytes memory _data;
        if (_token == address(0)) {
            _data = abi.encode(HBAR_TRANSFER, _to, _amount);
        } else {
            int32 tokenType = _tokenType(hederaService, _token);
            _data = abi.encode(TRANSFER, _to, _token, _amount, tokenType);
        }
        return
            _createProposalInternally(
                _title,
                _description,
                _linkToDiscussion,
                _nftTokenSerialId,
                _data
            );
    }

    function cancelProposal(
        string memory title
    ) public override returns (uint256 proposalId) {
        proposalId = super.cancelProposal(title);
        _untrackNFTSerialId(proposalId);
    }

    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 description
    ) internal virtual override {
        _executeOperation(proposalId);
        super._execute(proposalId, targets, values, calldatas, description);
        _untrackNFTSerialId(proposalId);
    }

    function _executeOperation(uint256 proposalId) private {
        bytes memory data = proposals[proposalId].data;
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
        (, address to, address _token, uint256 amount, int32 _tokenType) = abi
            .decode(_data, (uint256, address, address, uint256, int32));

        _validateTransfer(_token, _tokenType, amount);

        int256 code = _transferToken(
            hederaService,
            _token,
            address(this),
            to,
            amount
        );
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
        uint256 _nftTokenSerialId,
        bytes memory _data
    ) private returns (uint256) {
        uint256 proposalId = _createProposal(
            _title,
            _description,
            _linkToDiscussion,
            _data,
            _nftTokenSerialId
        );
        proposals[proposalId].data = _data;
        _trackNFTSerialId(_nftTokenSerialId, proposalId);
        return proposalId;
    }

    function _trackNFTSerialId(
        uint256 _nftTokenSerialId,
        uint256 proposalId
    ) private {
        if (_nftTokenSerialId != 0) {
            proposalBlockedNFTSerialIds[_nftTokenSerialId] = proposalId;
            emit NFTSerialIdBlockStatus(proposalId, _nftTokenSerialId, true);
        }
    }

    function _validateTransfer(
        address _token,
        int32 _tokenType,
        uint256 amountOrSerialId
    ) private view {
        if (token == _token) {
            _tokenType == 0
                ? _isFTTransferAllowed(_token, amountOrSerialId)
                : _isNFTTranferAllowed(amountOrSerialId);
        }
    }

    function _isFTTransferAllowed(
        address tokenToTransfer,
        uint256 amountOrIdToTransfer
    ) private view {
        uint256 _blockedTokenBalance = getBlockedTokenBalance();
        uint256 contractBalance = _balanceOf(tokenToTransfer, address(this));
        uint unblockedAmount = contractBalance - _blockedTokenBalance;
        require(unblockedAmount >= amountOrIdToTransfer, "GTT: Overdraft");
    }

    function _isNFTTranferAllowed(uint256 amountOrSerialId) private view {
        uint256 mappedProposalId = proposalBlockedNFTSerialIds[
            amountOrSerialId
        ];
        if (mappedProposalId != 0) {
            revert NFTSerialIdAlreadyBlockedByProposal({
                message: "NFT ID locked by proposal",
                proposalId: mappedProposalId,
                nftSerialId: amountOrSerialId
            });
        }
    }

    function _untrackNFTSerialId(uint256 proposalId) private {
        uint256 amountOrId = proposals[proposalId].amountOrId;
        if (proposalBlockedNFTSerialIds[amountOrId] != 0) {
            delete (proposalBlockedNFTSerialIds[amountOrId]);
            emit NFTSerialIdBlockStatus(proposalId, amountOrId, false);
        }
    }
}
