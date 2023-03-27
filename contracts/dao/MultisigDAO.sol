//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./BaseDAO.sol";
import "../gnosis/HederaGnosisSafe.sol";
import "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";

contract MultiSigDAO is BaseDAO {
    event TransactionCreated(bytes32 txnHash, TranscationInfo info);

    enum TransactionState {
        Pending,
        Approved,
        Executed
    }

    struct TranscationInfo {
        address to;
        uint256 value;
        bytes data;
        Enum.Operation operation;
        uint256 nonce;
    }

    HederaGnosisSafe private hederaGnosisSafe;
    mapping(bytes32 => TranscationInfo) private proposals;

    function initialize(
        address _admin,
        string calldata _name,
        string calldata _logoUrl,
        HederaGnosisSafe _hederaGnosisSafe
    ) external initializer {
        hederaGnosisSafe = _hederaGnosisSafe;
        __BaseDAO_init(_admin, _name, _logoUrl);
    }

    function getMultisigContractAddress() external view returns (address) {
        return address(hederaGnosisSafe);
    }

    function state(bytes32 txnHash) external view returns (TransactionState) {
        TranscationInfo memory transactionInfo = proposals[txnHash];
        require(transactionInfo.nonce != 0, "MultiSigDAO: no txn exist");
        if (hederaGnosisSafe.isTransactionExecuted(txnHash)) {
            return TransactionState.Executed;
        } else if (hederaGnosisSafe.checkSignatures(txnHash)) {
            return TransactionState.Approved;
        } else {
            return TransactionState.Pending;
        }
    }

    function getTransactionInfo(
        bytes32 txnHash
    ) external view returns (TranscationInfo memory) {
        TranscationInfo memory transactionInfo = proposals[txnHash];
        require(transactionInfo.nonce != 0, "MultiSigDAO: no txn exist");
        return transactionInfo;
    }

    function proposeTransaction(
        address _recieverAddress,
        address _token,
        uint256 _amount,
        Enum.Operation operation
    ) external payable returns (bytes32) {
        bytes memory _data = _getTransferABICallData(_recieverAddress, _amount);
        (bytes32 txnHash, uint256 txnNonce) = _proposeTransaction(
            _token,
            msg.value,
            _data,
            operation
        );
        TranscationInfo storage transactionInfo = proposals[txnHash];
        transactionInfo.to = _token;
        transactionInfo.value = msg.value;
        transactionInfo.data = _data;
        transactionInfo.operation = operation;
        transactionInfo.nonce = txnNonce;

        emit TransactionCreated(txnHash, transactionInfo);
        return txnHash;
    }

    function _getTransferABICallData(
        address _recieverAddress,
        uint256 _amount
    ) private pure returns (bytes memory) {
        return abi.encodeWithSelector(0xa9059cbb, _recieverAddress, _amount);
    }

    function _proposeTransaction(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation
    ) private returns (bytes32, uint256) {
        return hederaGnosisSafe.getTransactionHash(to, value, data, operation);
    }
}
