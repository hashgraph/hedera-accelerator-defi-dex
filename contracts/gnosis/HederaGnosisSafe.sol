// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "../common/BaseHTS.sol";
import "../common/hedera/HederaResponseCodes.sol";

import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import "@gnosis.pm/safe-contracts/contracts/external/GnosisSafeMath.sol";

contract HederaGnosisSafe is GnosisSafe, BaseHTS {
    event TokenAssociated(address token);

    event TokenTransferred(
        address indexed token,
        address indexed sender,
        int256 indexed amount
    );

    using GnosisSafeMath for uint256;

    bytes private constant BYTES_ZERO = "";
    uint256 private constant UINT_ZERO = 0;
    address payable private constant ADDRESS_ZERO = payable(address(0));

    uint256 private txnNonce;
    mapping(bytes32 => bool) public executedHash;

    function transferTokenToSafe(
        address token,
        int256 amount
    ) public returns (int256 responseCode) {
        address sender = msg.sender;
        responseCode = super.associateTokenPublic(address(this), token);
        if (responseCode == HederaResponseCodes.SUCCESS) {
            emit TokenAssociated(token);
        }
        responseCode = super.transferTokenPublic(
            token,
            sender,
            address(this),
            amount
        );
        if (responseCode == HederaResponseCodes.SUCCESS) {
            emit TokenTransferred(token, sender, amount);
        } else {
            revert("HederaGnosisSafe: tranfer token to safe failed");
        }
    }

    function transferTokenViaSafe(
        address token,
        address receiver,
        uint256 amount
    ) public returns (bool transferred) {
        require(msg.sender == address(this), "GS031"); // only via safe txn
        return super.transferToken(token, receiver, amount);
    }

    function getTransactionHash(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation
    ) public returns (bytes32, uint256) {
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

    function isTransactionExecuted(
        bytes32 dataHash
    ) public view returns (bool) {
        return executedHash[dataHash];
    }

    function checkApprovals(bytes32 dataHash) public view returns (bool) {
        uint256 approvedCount = 0;
        address currentOwner = owners[SENTINEL_OWNERS];
        while (currentOwner != SENTINEL_OWNERS) {
            if (approvedHashes[currentOwner][dataHash] == 1) {
                approvedCount++;
            }
            currentOwner = owners[currentOwner];
        }
        return approvedCount > 0 && approvedCount >= threshold;
    }

    function executeTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 nonce
    ) public payable returns (bool success) {
        bytes32 txHash;
        // Use scope here to limit variable lifetime and prevent `stack too deep` errors
        {
            bytes memory txHashData = encodeTransactionData(
                // Transaction info
                to,
                value,
                data,
                operation,
                UINT_ZERO,
                // Payment info
                UINT_ZERO,
                UINT_ZERO,
                ADDRESS_ZERO,
                ADDRESS_ZERO,
                // Signature info
                nonce
            );
            txHash = keccak256(txHashData);
        }
        // The cost of on-chain approval is really cheap for hashgraph hence there is no need of off-chain approval.
        // Also, Hashpack or equivalents wallets do not support ECDSA keys.
        // Note, on-chain signature verifaction is not available for ED25519 keys.
        require(checkApprovals(txHash), "Owner has not approved yet");
        require(
            !isTransactionExecuted(txHash),
            "HederaGnosisSafe: txn already executed"
        );
        executedHash[txHash] = true;
        address guard = getGuard();
        {
            if (guard != address(0)) {
                Guard(guard).checkTransaction(
                    // Transaction info
                    to,
                    value,
                    data,
                    operation,
                    UINT_ZERO,
                    // Payment info
                    UINT_ZERO,
                    UINT_ZERO,
                    ADDRESS_ZERO,
                    ADDRESS_ZERO,
                    // Signature info
                    BYTES_ZERO,
                    msg.sender
                );
            }
        }
        // We require some gas to emit the events (at least 2500) after the execution and some to perform code until the execution (500)
        // We also include the 1/64 in the check that is not send along with a call to counteract potential shortings because of EIP-150
        require(
            gasleft() >= ((UINT_ZERO * 64) / 63).max(UINT_ZERO + 2500) + 500,
            "GS010"
        );
        // Use scope here to limit variable lifetime and prevent `stack too deep` errors
        {
            uint256 gasUsed = gasleft();
            // If the gasPrice is 0 we assume that nearly all available gas can be used (it is always more than safeTxGas)
            // We only substract 2500 (compared to the 3000 before) to ensure that the amount passed is still higher than safeTxGas
            success = execute(
                to,
                value,
                data,
                operation,
                UINT_ZERO == 0 ? (gasleft() - 2500) : UINT_ZERO
            );
            gasUsed = gasUsed.sub(gasleft());
            // If no safeTxGas and no gasPrice was set (e.g. both are 0), then the internal tx is required to be successful
            // This makes it possible to use `estimateGas` without issues, as it searches for the minimum gas where the tx doesn't revert
            require(success || UINT_ZERO != 0 || UINT_ZERO != 0, "GS013");
            // We transfer the calculated tx costs to the tx.origin to avoid sending it to intermediate contracts that have made calls
            uint256 payment = 0;
            if (UINT_ZERO > 0) {
                payment = _handlePayment(
                    gasUsed,
                    UINT_ZERO,
                    UINT_ZERO,
                    ADDRESS_ZERO,
                    ADDRESS_ZERO
                );
            }
            if (success) emit ExecutionSuccess(txHash, payment);
            else emit ExecutionFailure(txHash, payment);
        }
        {
            if (guard != address(0)) {
                Guard(guard).checkAfterExecution(txHash, success);
            }
        }
    }

    function _handlePayment(
        uint256 gasUsed,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver
    ) private returns (uint256 payment) {
        // solhint-disable-next-line avoid-tx-origin
        address payable receiver = refundReceiver == address(0)
            ? payable(tx.origin)
            : refundReceiver;
        if (gasToken == address(0)) {
            // For ETH we will only adjust the gas price to not be higher than the actual used gas price
            payment = gasUsed.add(baseGas).mul(
                gasPrice < tx.gasprice ? gasPrice : tx.gasprice
            );
            require(receiver.send(payment), "GS011");
        } else {
            payment = gasUsed.add(baseGas).mul(gasPrice);
            require(transferToken(gasToken, receiver, payment), "GS012");
        }
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
