//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./BaseDAO.sol";
import "../common/IEvents.sol";
import "../common/IHederaService.sol";
import "../common/ISystemRoleBasedAccess.sol";
import "../gnosis/HederaMultiSend.sol";
import "../gnosis/HederaGnosisSafe.sol";
import "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";

contract MultiSigDAO is IEvents, BaseDAO {
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
    string private constant HederaService = "HederaService";
    string private constant MultiSend = "HederaMultiSend";
    string private constant HederaSafe = "HederaGnosisSafe";

    uint256 private constant TXN_TYPE_BATCH = 1;
    uint256 private constant TXN_TYPE_TOKEN_ASSOCIATE = 2;
    uint256 private constant TXN_TYPE_UPGRADE_PROXY = 3;
    uint256 private constant TXN_TYPE_TRANSFER = 4;

    HederaMultiSend private multiSend;
    IHederaService private hederaService;
    HederaGnosisSafe private hederaGnosisSafe;
    ISystemRoleBasedAccess private iSystemRoleBasedAccess;
    mapping(bytes32 => TransactionInfo) private transactions;

    function initialize(
        address _admin,
        string memory _name,
        string memory _logoUrl,
        string memory _description,
        string[] memory _webLinks,
        HederaGnosisSafe _hederaGnosisSafe,
        IHederaService _hederaService,
        HederaMultiSend _multiSend,
        ISystemRoleBasedAccess _iSystemRoleBasedAccess
    ) external initializer {
        hederaService = _hederaService;
        hederaGnosisSafe = _hederaGnosisSafe;
        multiSend = _multiSend;
        iSystemRoleBasedAccess = _iSystemRoleBasedAccess;
        __BaseDAO_init(_admin, _name, _logoUrl, _description, _webLinks);
        emit LogicUpdated(address(0), address(hederaService), HederaService);
        emit LogicUpdated(address(0), address(multiSend), MultiSend);
        emit LogicUpdated(address(0), address(hederaGnosisSafe), HederaSafe);
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
    ) public returns (bytes32) {
        require(bytes(title).length != 0, "MultiSigDAO: title can't be blank");
        require(bytes(desc).length != 0, "MultiSigDAO: desc can't be blank");
        Enum.Operation _operation = Enum.Operation.Call;
        (bytes32 txnHash, uint256 txnNonce) = hederaGnosisSafe.getTxnHash(
            _to,
            0,
            _data,
            _operation
        );
        TransactionInfo storage transactionInfo = transactions[txnHash];
        transactionInfo.to = _to;
        transactionInfo.value = 0;
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

    function proposeTokenAssociateTransaction(
        address _token,
        string memory _title,
        string memory _desc,
        string memory _linkToDiscussion
    ) external returns (bytes32) {
        bytes memory data = abi.encodeWithSelector(
            HederaGnosisSafe.associateToken.selector,
            hederaService,
            _token
        );
        return
            proposeTransaction(
                address(hederaGnosisSafe),
                data,
                TXN_TYPE_TOKEN_ASSOCIATE,
                _title,
                _desc,
                _linkToDiscussion
            );
    }

    function proposeBatchTransaction(
        address[] memory _targets,
        uint256[] memory _values,
        bytes[] memory _calldatas,
        string memory title,
        string memory desc,
        string memory linkToDiscussion
    ) public returns (bytes32) {
        require(
            _targets.length > 0 &&
                _targets.length == _values.length &&
                _targets.length == _calldatas.length,
            "MultiSigDAO: invalid transaction length"
        );
        bytes memory transactionsBytes;
        for (uint256 i = 0; i < _targets.length; i++) {
            transactionsBytes = abi.encodePacked(
                transactionsBytes,
                uint8(0),
                _targets[i],
                _values[i],
                _calldatas[i].length,
                _calldatas[i]
            );
        }
        bytes memory data = abi.encodeWithSelector(
            MultiSendCallOnly.multiSend.selector,
            transactionsBytes
        );
        return
            proposeTransaction(
                address(multiSend),
                data,
                TXN_TYPE_BATCH,
                title,
                desc,
                linkToDiscussion
            );
    }

    function proposeUpgradeProxyTransaction(
        address _proxy,
        address _proxyLogic,
        string memory _title,
        string memory _desc,
        string memory _linkToDiscussion
    ) external returns (bytes32) {
        require(_proxy != address(0), "MultiSigDAO: proxy can't be zero");
        require(_proxyLogic != address(0), "MultiSigDAO: logic can't be zero");
        bytes memory data = abi.encodeWithSelector(
            HederaGnosisSafe.upgradeProxy.selector,
            _proxy,
            _proxyLogic,
            iSystemRoleBasedAccess.getSystemUsers().proxyAdmin
        );
        return
            proposeTransaction(
                address(hederaGnosisSafe),
                data,
                TXN_TYPE_UPGRADE_PROXY,
                _title,
                _desc,
                _linkToDiscussion
            );
    }

    function proposeTransferTransaction(
        address _to,
        address _token,
        uint256 _amount,
        string memory _title,
        string memory _desc,
        string memory _linkToDiscussion
    ) external returns (bytes32) {
        bytes memory data = abi.encodeWithSelector(
            HederaGnosisSafe.transferAssets.selector,
            hederaService,
            _token,
            _to,
            _amount
        );
        return
            proposeTransaction(
                address(hederaGnosisSafe),
                data,
                TXN_TYPE_TRANSFER,
                _title,
                _desc,
                _linkToDiscussion
            );
    }

    function upgradeHederaService(IHederaService newHederaService) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        emit LogicUpdated(
            address(hederaService),
            address(newHederaService),
            HederaService
        );
        hederaService = newHederaService;
    }

    function upgradeMultiSend(HederaMultiSend _multiSend) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        emit LogicUpdated(address(multiSend), address(_multiSend), MultiSend);
        multiSend = _multiSend;
    }

    function upgradeHederaGnosisSafe(
        HederaGnosisSafe _hederaGnosisSafe
    ) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        emit LogicUpdated(
            address(hederaGnosisSafe),
            address(_hederaGnosisSafe),
            HederaSafe
        );
        hederaGnosisSafe = _hederaGnosisSafe;
    }

    function getHederaGnosisSafeContractAddress()
        external
        view
        returns (address)
    {
        return address(hederaGnosisSafe);
    }

    function getHederaServiceVersion() external view returns (IHederaService) {
        return hederaService;
    }

    function getMultiSendContractAddress() external view returns (address) {
        return address(multiSend);
    }

    /**
     * This functon is used to uniquely identify text proposals. Transaction data is created using encoding of
     * this function. As the text and creator are unique hence will generate unique hash for transactions.
     *  Gnosis safe executes this function once transaction is approved by owners.
     */
    function setText(
        address creator,
        string memory text
    ) public view returns (address, string memory) {
        require(
            address(hederaGnosisSafe) == msg.sender,
            "Only HederaGnosisSafe can execute it."
        );
        return (creator, text);
    }
}
