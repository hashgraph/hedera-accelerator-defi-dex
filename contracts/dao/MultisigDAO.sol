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
        address to,
        bytes memory data,
        Enum.Operation operation
    ) public payable returns (bytes32) {
        (bytes32 txnHash, uint256 txnNonce) = hederaGnosisSafe
            .getTransactionHash(to, msg.value, data, operation);
        TranscationInfo storage transactionInfo = proposals[txnHash];
        transactionInfo.to = to;
        transactionInfo.value = msg.value;
        transactionInfo.data = data;
        transactionInfo.operation = operation;
        transactionInfo.nonce = txnNonce;

        emit TransactionCreated(txnHash, transactionInfo);
        return txnHash;
    }

    function proposeTransferTransaction(
        address _token,
        address _receiver,
        uint256 _amount
    ) external payable returns (bytes32) {
        // HederaGnosisSafe#transferTokenViaSafe(address token, address receiver, uint256 amount)
        // 0xbb34db5a - keccack("transferTokenViaSafe(address,address,uint256)")
        bytes memory data = abi.encodeWithSelector(
            0xbb34db5a,
            _token,
            _receiver,
            _amount
        );
        Enum.Operation call = Enum.Operation.Call;
        return proposeTransaction(address(hederaGnosisSafe), data, call);
    }
}
