//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./BaseDAO.sol";
import "../common/IEvents.sol";
import "../common/IHederaService.sol";
import "../common/ISystemRoleBasedAccess.sol";
import "../gnosis/HederaMultiSend.sol";
import "../gnosis/HederaGnosisSafe.sol";
import "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";

/**
 * @title MultiSig DAO
 *
 * The contract allows to creates different types of proposals.
 */
contract MultiSigDAO is IEvents, BaseDAO {
    /**
     * @notice TransactionCreated event.
     * @dev Emitted when user creates a new proposal.
     *
     * @param txnHash The transaction hash.
     * @param info The transaction info.
     */
    event TransactionCreated(bytes32 txnHash, TransactionInfo info);

    // Transaction State
    enum TransactionState {
        Pending,
        Approved,
        Executed
    }

    // Transaction Info struct
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
        string metaData;
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

    /**
     * @dev Initializes the contract with the required parameters.
     *
     * @param _admin The admin address.
     * @param _name The DAO name.
     * @param _logoUrl The DAO logo URL.
     * @param _infoUrl The DAO info URL.
     * @param _description The DAO description.
     * @param _webLinks The DAO web links.
     * @param _hederaGnosisSafe The address of the Hedera Gnosis Safe contract.
     * @param _hederaService The Hedera service address.
     * @param _multiSend The address of the Hedera multisend contract.
     * @param _iSystemRoleBasedAccess The address of the roles manager contract.
     */
    function initialize(
        address _admin,
        string memory _name,
        string memory _logoUrl,
        string memory _infoUrl,
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
        __BaseDAO_init(
            _admin,
            _name,
            _logoUrl,
            _infoUrl,
            _description,
            _webLinks
        );
        emit LogicUpdated(address(0), address(hederaService), HederaService);
        emit LogicUpdated(address(0), address(multiSend), MultiSend);
        emit LogicUpdated(address(0), address(hederaGnosisSafe), HederaSafe);
    }

    /**
     * @dev Returns a transaction state.
     *
     * @param _txnHash The transaction hash.
     * @return The transaction state struct with info.
     */
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

    /**
     * @dev Returns the approvals number for the transaction.
     *
     * @param _txnHash The transaction hash.
     * @return The approvals number.
     */
    function getApprovalCounts(bytes32 _txnHash) public view returns (uint256) {
        return hederaGnosisSafe.getApprovalCounts(_txnHash);
    }

    /**
     * @dev Returns a transaction info.
     *
     * @param _txnHash The transaction hash.
     * @return The transaction info struct.
     */
    function getTransactionInfo(
        bytes32 _txnHash
    ) external view returns (TransactionInfo memory) {
        TransactionInfo memory transactionInfo = transactions[_txnHash];
        require(transactionInfo.nonce != 0, "MultiSigDAO: no txn exist");
        return transactionInfo;
    }

    /**
     * @dev Creates a proposal.
     * @notice we are only supporting the 'call' not 'delegatecall' from dao
     *
     * @param _to The to address.
     * @param _data The proposal data.
     * @param _type The proposal type.
     * @param title The proposal title.
     * @param desc The proposal description.
     * @param linkToDiscussion The link to proposal discussion.
     * @param metaData The tx metadata.
     * @return The transaction hash.
     */
    function proposeTransaction(
        address _to,
        bytes memory _data,
        uint256 _type,
        string memory title,
        string memory desc,
        string memory linkToDiscussion,
        string memory metaData
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
        transactionInfo.metaData = metaData;
        transactionInfo.creator = msg.sender;

        emit TransactionCreated(txnHash, transactionInfo);
        return txnHash;
    }

    /**
     * @dev Creates a proposal on token association.
     *
     * @param _token The token address to associate with.
     * @param _title The proposal title.
     * @param _desc The proposal description.
     * @param _linkToDiscussion The link to proposal discussion.
     * @return The transaction hash.
     */
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
                _linkToDiscussion,
                ""
            );
    }

    /**
     * @dev Creates a proposal with batch transaction.
     *
     * @param _targets The batch targets.
     * @param _values The batch values.
     * @param _calldatas The batch calldatas.
     * @param title The proposal title.
     * @param desc The proposal description.
     * @param linkToDiscussion The link to proposal discussion.
     * @return The transaction hash.
     */
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
                linkToDiscussion,
                ""
            );
    }

    /**
     * @dev Creates a proposal on proxy upgrade.
     *
     * @param _proxy The new proxy address.
     * @param _proxyLogic The new proxy logic address.
     * @param _title The proposal title.
     * @param _desc The proposal description.
     * @param _linkToDiscussion The link to proposal discussion.
     * @return The transaction hash.
     */
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
                _linkToDiscussion,
                ""
            );
    }

    /**
     * @dev Creates a new transfer proposal.
     *
     * @param _to The receiver address.
     * @param _token The token address.
     * @param _amount The amount to send.
     * @param _title The proposal title.
     * @param _desc The proposal description.
     * @param _linkToDiscussion The link to proposal discussion.
     * @return The transaction hash.
     */
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
                _linkToDiscussion,
                ""
            );
    }

    /**
     * @dev Upgrades the Hedera service implementation.
     *
     * @param newHederaService The address of the new implementation.
     */
    function upgradeHederaService(IHederaService newHederaService) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        emit LogicUpdated(
            address(hederaService),
            address(newHederaService),
            HederaService
        );
        hederaService = newHederaService;
    }

    /**
     * @dev Upgrades the Hedera multi send implementation.
     *
     * @param _multiSend The address of the new implementation.
     */
    function upgradeMultiSend(HederaMultiSend _multiSend) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        emit LogicUpdated(address(multiSend), address(_multiSend), MultiSend);
        multiSend = _multiSend;
    }

    /**
     * @dev Upgrades the Hedera gnosis safe implementation.
     *
     * @param _hederaGnosisSafe The address of the new implementation.
     */
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

    /**
     * @dev Returns the Hedera gnosis safe contract address.
     */
    function getHederaGnosisSafeContractAddress()
        external
        view
        returns (address)
    {
        return address(hederaGnosisSafe);
    }

    /**
     * @dev Returns the Hedera service version.
     */
    function getHederaServiceVersion() external view returns (IHederaService) {
        return hederaService;
    }

    /**
     * @dev Returns the Hedera multisend contract address.
     */
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
