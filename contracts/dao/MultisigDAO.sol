//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./BaseDAO.sol";
import "../common/IHederaService.sol";
import "../common/RoleBasedAccess.sol";
import "../gnosis/HederaMultiSend.sol";
import "../gnosis/HederaGnosisSafe.sol";
import "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";

contract MultiSigDAO is BaseDAO, RoleBasedAccess {
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
        uint256 transactionType;
        string title;
        string description;
        string linkToDiscussion;
        address creator;
    }

    bytes4 private constant MULTI_SEND_TXN_SELECTOR =
        bytes4(keccak256("multiSend(bytes)"));

    bytes4 private constant TRANSFER_TOKEN_FROM_SAFE_SELECTOR =
        bytes4(keccak256("transferTokenViaSafe(address,address,uint256)"));

    modifier onlySystemUser() {
        require(
            systemUser == _msgSender(),
            "MultiSigDAO: caller is not the system user"
        );
        _;
    }

    uint256 private constant TXN_TYPE_TOKEN_TRANSFER = 1;
    uint256 private constant TXN_TYPE_BATCH = 2;

    address private systemUser;
    HederaMultiSend private multiSend;
    IHederaService private hederaService;
    HederaGnosisSafe private hederaGnosisSafe;
    mapping(bytes32 => TransactionInfo) private transactions;

    function initialize(
        address _admin,
        string memory _name,
        string memory _logoUrl,
        string memory _description,
        string[] memory _webLinks,
        HederaGnosisSafe _hederaGnosisSafe,
        IHederaService _hederaService,
        HederaMultiSend _multiSend
    ) external initializer {
        systemUser = msg.sender;
        hederaService = _hederaService;
        hederaGnosisSafe = _hederaGnosisSafe;
        multiSend = _multiSend;
        __BaseDAO_init(_admin, _name, _logoUrl, _description, _webLinks);
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

    function getApprovalCounts(bytes32 _txnHash) public view returns (uint256) {
        return hederaGnosisSafe.getApprovalCounts(_txnHash);
    }

    function getTransactionInfo(
        bytes32 _txnHash
    ) external view returns (TransactionInfo memory) {
        TransactionInfo memory transactionInfo = transactions[_txnHash];
        require(transactionInfo.nonce != 0, "MultiSigDAO: no txn exist");
        return transactionInfo;
    }

    // we are only supporting the 'call' not 'delegatecall' from dao
    function proposeTransaction(
        address _to,
        bytes memory _data,
        uint256 _type,
        string memory title,
        string memory desc,
        string memory linkToDiscussion
    ) public payable returns (bytes32) {
        require(bytes(title).length != 0, "MultiSigDAO: title can't be blank");
        require(bytes(desc).length != 0, "MultiSigDAO: desc can't be blank");
        Enum.Operation _operation = Enum.Operation.Call;
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
        transactionInfo.transactionType = _type;
        transactionInfo.title = title;
        transactionInfo.description = desc;
        transactionInfo.linkToDiscussion = linkToDiscussion;
        transactionInfo.creator = msg.sender;

        emit TransactionCreated(txnHash, transactionInfo);
        return txnHash;
    }

    function proposeTransferTransaction(
        address _token,
        address _receiver,
        uint256 _amount,
        string memory title,
        string memory desc,
        string memory linkToDiscussion
    ) external payable returns (bytes32) {
        hederaGnosisSafe.transferToSafe(
            hederaService,
            _token,
            _amount,
            msg.sender
        );
        bytes memory data = abi.encodeWithSelector(
            TRANSFER_TOKEN_FROM_SAFE_SELECTOR,
            _token,
            _receiver,
            _amount
        );
        return
            proposeTransaction(
                address(hederaGnosisSafe),
                data,
                call,
                1,
                title,
                desc,
                linkToDiscussion
            );
    }

    function upgradeHederaService(
        IHederaService newHederaService
    ) external onlySystemUser {
        hederaService = newHederaService;
    }

    function upgradeMultiSend(
        HederaMultiSend _multiSend
    ) external onlySystemUser {
        multiSend = _multiSend;
    }

    function getHederaServiceVersion() external view returns (IHederaService) {
        return hederaService;
    }

    function getMultiSendContractAddress() external view returns (address) {
        return address(multiSend);
    }
}
