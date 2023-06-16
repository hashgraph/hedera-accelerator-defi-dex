//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./BaseDAO.sol";
import "../common/IHederaService.sol";
import "../gnosis/HederaGnosisSafe.sol";
import "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";

contract MultiSigDAO is BaseDAO {
    address private systemUser;
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

    modifier onlySystemUser() {
        require(
            systemUser == _msgSender(),
            "MultiSigDAO: caller is not the system user"
        );
        _;
    }

    // HederaGnosisSafe#transferTokenViaSafe(address token, address receiver, uint256 amount)
    bytes4 private constant TRANSFER_TOKEN_FROM_SAFE_SELECTOR =
        bytes4(keccak256("transferTokenViaSafe(address,address,uint256)"));

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
        IHederaService _hederaService
    ) external initializer {
        hederaService = _hederaService;
        hederaGnosisSafe = _hederaGnosisSafe;
        __BaseDAO_init(_admin, _name, _logoUrl, _description, _webLinks);
        systemUser = msg.sender;
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

    function proposeTransaction(
        address _to,
        bytes memory _data,
        Enum.Operation _operation,
        uint256 _type,
        string memory title,
        string memory desc,
        string memory linkToDiscussion
    ) public payable returns (bytes32) {
        require(bytes(title).length != 0, "MultiSigDAO: title can't be blank");
        require(bytes(desc).length != 0, "MultiSigDAO: desc can't be blank");

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
        Enum.Operation call = Enum.Operation.Call;
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

    function getHederaServiceVersion() external view returns (IHederaService) {
        return hederaService;
    }
}
