// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.18;

import "../common/IHederaService.sol";
import "../common/TokenOperations.sol";

import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import "@gnosis.pm/safe-contracts/contracts/external/GnosisSafeMath.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

/**
 * @title Hedera Gnosis Safe
 *
 * The implementation of the Safe wallet on Hedera.
 */
contract HederaGnosisSafe is
    GnosisSafe,
    ReentrancyGuardUpgradeable,
    TokenOperations
{
    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;

    using GnosisSafeMath for uint256;

    bytes private constant BYTES_ZERO = "";
    uint256 private constant UINT_ZERO = 0;
    address payable private constant ADDRESS_ZERO = payable(address(0));

    uint256 private txnNonce;
    mapping(bytes32 => bool) public executedHash;

    /**
     * @dev Checks if the transaction was executed.
     *
     * @param dataHash The transaction data hash.
     */
    function isTransactionExecuted(
        bytes32 dataHash
    ) public view returns (bool) {
        return executedHash[dataHash];
    }

    /**
     * @dev Checks if the transaction was approved.
     *
     * @param dataHash The transaction data hash.
     */
    function checkApprovals(bytes32 dataHash) public view returns (bool) {
        uint256 approvedCount = getApprovalCounts(dataHash);
        return approvedCount > 0 && approvedCount >= threshold;
    }

    /**
     * @dev Returns the number of approvals.
     *
     * @param dataHash The transaction data hash.
     */
    function getApprovalCounts(
        bytes32 dataHash
    ) public view returns (uint256 approvedCount) {
        address currentOwner = owners[SENTINEL_OWNERS];
        while (currentOwner != SENTINEL_OWNERS) {
            if (approvedHashes[currentOwner][dataHash] == 1) {
                approvedCount++;
            }
            currentOwner = owners[currentOwner];
        }
    }

    /**
     * @dev Upgrades proxy.
     *
     * @param _proxy The proxy address.
     * @param _proxyLogic The logic contract.
     * @param _proxyAdmin The proxy admin.
     */
    function upgradeProxy(
        address _proxy,
        address _proxyLogic,
        address _proxyAdmin
    ) external {
        require(msg.sender == address(this), "GS031"); // only via safe txn
        (bool success, ) = _proxy.call(
            abi.encodeWithSignature("upgradeTo(address)", _proxyLogic)
        );
        require(success, "HederaGnosisSafe: failed to upgrade proxy");
        (success, ) = _proxy.call(
            abi.encodeWithSignature("changeAdmin(address)", _proxyAdmin)
        );
        require(success, "HederaGnosisSafe: failed to change admin");
    }

    /**
     * @dev Associates the token with the contract.
     *
     * @param _hederaService The Hedera service address.
     * @param _token The token to associate with.
     */
    function associateToken(
        IHederaService _hederaService,
        address _token
    ) external {
        require(msg.sender == address(this), "GS031"); // only via safe txn
        int256 code = _associateToken(_hederaService, address(this), _token);
        if (
            code != HederaResponseCodes.SUCCESS &&
            code != HederaResponseCodes.TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT
        ) {
            revert("HederaGnosisSafe: association failed to safe");
        }
    }

    /**
     * @dev Transfers the passed token.
     *
     * @param _hederaService The Hedera service address.
     * @param _token The token to transfer.
     * @param _to The receiver address.
     * @param _amount The amount to transfer.
     */
    function transferAssets(
        IHederaService _hederaService,
        address _token,
        address _to,
        uint256 _amount
    ) external {
        require(msg.sender == address(this), "GS031"); // only via safe txn
        bool sent;
        if (_token == address(0)) {
            (sent, ) = payable(_to).call{value: _amount}("");
        } else {
            int256 code = _transferToken(
                _hederaService,
                _token,
                address(this),
                _to,
                _amount
            );
            sent = code == HederaResponseCodes.SUCCESS;
        }
        require(sent, "HederaGnosisSafe: transfer failed from safe");
    }

    /**
     * @dev Returns the transaction hash.
     *F
     * @param to The tx receiver.
     * @param value The transaction value.
     * @param data The transaction data.
     * @param operation The operation.
     */
    function getTxnHash(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation
    ) external returns (bytes32, uint256) {
        bytes32 txnHash = super.getTransactionHash(
            to,
            value,
            data,
            operation,
            UINT_ZERO,
            UINT_ZERO,
            UINT_ZERO,
            ADDRESS_ZERO,
            ADDRESS_ZERO,
            ++txnNonce // to make txnhash unique, updating txnNonce everytime and shouldn't be changed to prioir discussion.
        );
        return (txnHash, txnNonce);
    }

    /**
     * @dev Executes the transaction.
     *
     * @param to The tx receiver.
     * @param value The transaction value.
     * @param data The transaction data.
     * @param operation The operation.
     * @param nonce The operation.
     */
    function executeTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 nonce
    ) external payable nonReentrant returns (bool success) {
        bytes32 txHash = keccak256(
            encodeTransactionData(
                to,
                value,
                data,
                operation,
                UINT_ZERO,
                UINT_ZERO,
                UINT_ZERO,
                ADDRESS_ZERO,
                ADDRESS_ZERO,
                nonce
            )
        );
        // The cost of on-chain approval is really cheap for hashgraph hence there is no need of off-chain approval.
        // Also, Hashpack or equivalents wallets do not support ECDSA keys.
        // Note, on-chain signature verifaction is not available for ED25519 keys.
        require(checkApprovals(txHash), "Owner has not approved yet");
        require(
            !isTransactionExecuted(txHash),
            "HederaGnosisSafe: txn already executed"
        );
        executedHash[txHash] = true;
        success = execute(to, value, data, operation, gasleft() - 2500);
        require(success, "GS013");
        emit ExecutionSuccess(txHash, UINT_ZERO);
    }

    /**
     * @dev Disabled function from the main contract.
     */
    function execTransaction(
        address,
        uint256,
        bytes calldata,
        Enum.Operation,
        uint256,
        uint256,
        uint256,
        address,
        address payable,
        bytes memory
    ) public payable override returns (bool) {
        revert("HederaGnosisSafe: API not available");
    }
}
