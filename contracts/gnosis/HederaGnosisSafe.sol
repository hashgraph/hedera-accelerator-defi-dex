// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.18;

import "../common/IHederaService.sol";
import "../common/TokenOperations.sol";

import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import "@gnosis.pm/safe-contracts/contracts/external/GnosisSafeMath.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract HederaGnosisSafe is
    GnosisSafe,
    ReentrancyGuardUpgradeable,
    TokenOperations
{
    using GnosisSafeMath for uint256;

    bytes private constant BYTES_ZERO = "";
    uint256 private constant UINT_ZERO = 0;
    address payable private constant ADDRESS_ZERO = payable(address(0));

    uint256 private txnNonce;
    mapping(bytes32 => bool) public executedHash;

    function isTransactionExecuted(
        bytes32 dataHash
    ) public view returns (bool) {
        return executedHash[dataHash];
    }

    function checkApprovals(bytes32 dataHash) public view returns (bool) {
        uint256 approvedCount = getApprovalCounts(dataHash);
        return approvedCount > 0 && approvedCount >= threshold;
    }

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

    function transferAssets(
        address token,
        address receiver,
        uint256 amount
    ) external {
        require(msg.sender == address(this), "GS031"); // only via safe txn
        bool sent;
        if (token == address(0)) {
            (sent, ) = payable(receiver).call{value: amount}("");
        } else {
            sent =
                _transferToken(token, address(this), receiver, amount) ==
                HederaResponseCodes.SUCCESS;
        }
        require(sent, "HederaGnosisSafe: transfer failed from safe");
    }

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
