//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./BaseDAO.sol";
import "../common/IBaseHTS.sol";
import "../gnosis/HederaGnosisSafe.sol";
import "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";

contract MultiSigDAO is BaseDAO {
    event TransactionCreated(bytes32 txnHash, TransactionInfo info);

    enum TransactionState {
        Pending,
        Approved,
        Executed
    }

    struct TransactionInfo {
        address to;
        uint256 value;
        bytes data;
        Enum.Operation operation;
        uint256 nonce;
    }

    // HederaGnosisSafe#transferTokenViaSafe(address token, address receiver, uint256 amount)
    // 0xbb34db5a - keccack("transferTokenViaSafe(address,address,uint256)")
    bytes4 private constant TRANSFER_TOKEN_FROM_SAFE_SELECTOR = 0xbb34db5a;

    IBaseHTS private baseHTS;
    HederaGnosisSafe private hederaGnosisSafe;
    mapping(bytes32 => TransactionInfo) private transactions;

    function initialize(
        address _admin,
        string calldata _name,
        string calldata _logoUrl,
        HederaGnosisSafe _hederaGnosisSafe,
        IBaseHTS _iBaseHTS
    ) external initializer {
        baseHTS = _iBaseHTS;
        hederaGnosisSafe = _hederaGnosisSafe;
        __BaseDAO_init(_admin, _name, _logoUrl);
    }

    function getHederaGnosisSafeContractAddress()
        external
        view
        returns (address)
    {
        return address(hederaGnosisSafe);
    }

    function state(bytes32 _txnHash) external view returns (TransactionState) {
        TransactionInfo memory transactionInfo = transactions[_txnHash];
        require(transactionInfo.nonce != 0, "MultiSigDAO: no txn exist");
        if (hederaGnosisSafe.isTransactionExecuted(_txnHash)) {
            return TransactionState.Executed;
        } else if (hederaGnosisSafe.checkApprovals(_txnHash)) {
            return TransactionState.Approved;
        } else {
            return TransactionState.Pending;
        }
    }

    function getTransactionInfo(
        bytes32 _txnHash
    ) external view returns (TransactionInfo memory) {
        TransactionInfo memory transactionInfo = transactions[_txnHash];
        require(transactionInfo.nonce != 0, "MultiSigDAO: no txn exist");
        return transactionInfo;
    }

    function proposeTransaction(
        address _to,
        bytes memory _data,
        Enum.Operation _operation
    ) public payable returns (bytes32) {
        (bytes32 txnHash, uint256 txnNonce) = hederaGnosisSafe.getTxnHash(
            _to,
            msg.value,
            _data,
            _operation
        );
        TransactionInfo storage transactionInfo = transactions[txnHash];
        transactionInfo.to = _to;
        transactionInfo.value = msg.value;
        transactionInfo.data = _data;
        transactionInfo.operation = _operation;
        transactionInfo.nonce = txnNonce;

        emit TransactionCreated(txnHash, transactionInfo);
        return txnHash;
    }

    function proposeTransferTransaction(
        address _token,
        address _receiver,
        uint256 _amount
    ) external payable returns (bytes32) {
        hederaGnosisSafe.transferToSafe(baseHTS, _token, _amount, msg.sender);
        bytes memory data = abi.encodeWithSelector(
            TRANSFER_TOKEN_FROM_SAFE_SELECTOR,
            _token,
            _receiver,
            _amount
        );
        Enum.Operation call = Enum.Operation.Call;
        return proposeTransaction(address(hederaGnosisSafe), data, call);
    }
}
