//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./ITokenType.sol";
import "./ERC20Mock.sol";
import "./IERC20Mock.sol";

import "../common/IERC721.sol";
import "../common/IHederaService.sol";
import "../common/hedera/HederaResponseCodes.sol";

contract MockHederaService is IHederaService {
    uint256 private constant PASS_TXN_COUNT = 100;
    bytes32 revertCreateTokenSlot = keccak256("revertCreateTokenSlot");
    bytes32 passTransactionCountSlot = keccak256("passTransactionCountSlot");
    bytes32 tokenTestSlot = keccak256("tokenTestSlot");

    constructor(bool _tokenTest) {
        StorageSlot.Uint256Slot storage passTransactionCount = StorageSlot
            .getUint256Slot(passTransactionCountSlot);
        passTransactionCount.value = PASS_TXN_COUNT;

        StorageSlot.BooleanSlot storage isTokenTest = StorageSlot
            .getBooleanSlot(tokenTestSlot);
        isTokenTest.value = _tokenTest;
    }

    function setPassTransactionCount(int256 _passTransactionCount) public {
        StorageSlot.Uint256Slot storage passTransactionCount = StorageSlot
            .getUint256Slot(passTransactionCountSlot);
        passTransactionCount.value = uint256(_passTransactionCount);
    }

    function setRevertCreateToken(bool _revertCreateToken) public {
        StorageSlot.Uint256Slot storage revertCreateToken = StorageSlot
            .getUint256Slot(revertCreateTokenSlot);
        revertCreateToken.value = (_revertCreateToken == true) ? 1 : 0;
    }

    function associateTokenPublic(
        address,
        address
    ) external pure override returns (int256) {
        return 22;
    }

    function mintTokenPublic(
        address tokenAddress,
        uint256 amount
    ) external override returns (int256, int64) {
        ERC20Mock token = ERC20Mock(tokenAddress);
        if (isFailureToken(token.name())) {
            return (23, int64(-1));
        } else {
            token.setTotal(amount);
            return (22, int64(int256(amount)));
        }
    }

    function burnTokenPublic(
        address tokenAddress,
        uint256 amount
    ) external override returns (int256, int64) {
        ERC20Mock token = ERC20Mock(tokenAddress);
        if (isFailureToken(token.name())) {
            return (23, int64(-1));
        } else {
            token.setTotal(amount);
            return (22, int64(int256(amount)));
        }
    }

    function createFungibleTokenPublic(
        IHederaTokenService.HederaToken memory tokenToCreate,
        uint256 initialTotalSupply,
        uint256
    )
        external
        payable
        override
        returns (int256 responseCode, address tokenAddress)
    {
        if (isFailureToken(tokenToCreate.name)) {
            responseCode = 23;
            tokenAddress = address(0x0);
        } else {
            tokenAddress = address(
                new ERC20Mock(
                    tokenToCreate.name,
                    tokenToCreate.symbol,
                    initialTotalSupply,
                    initialTotalSupply
                )
            );
            responseCode = 22;
        }
        return (responseCode, tokenAddress);
    }

    function isFailureToken(string memory lsh) private pure returns (bool) {
        return (keccak256(abi.encode(lsh)) == keccak256(abi.encode("FAIL")));
    }

    function getResponseCode() private returns (int) {
        uint256 _passTransactionCount = StorageSlot
            .getUint256Slot(passTransactionCountSlot)
            .value;
        if (_passTransactionCount > 1) {
            // _passTransactionCount shouldn't be < PASS_TXN_COUNT for call
            //  it might be > PASS_TXN_COUNT with delegatecall
            if (_passTransactionCount < PASS_TXN_COUNT) {
                _passTransactionCount -= 1;
            }
            StorageSlot
                .getUint256Slot(passTransactionCountSlot)
                .value = _passTransactionCount;
            return int(22);
        }

        return int(23);
    }

    function transferHBAR(
        address payable
    ) external payable override returns (bool) {
        return getResponseCode() == int(22) ? true : false;
    }

    function getTokenTypePublic(
        address _token
    ) external override returns (int64 responseCode, int32 tokenType) {
        return
            getResponseCode() == int(22)
                ? (int64(22), ITokenType(_token).tokenType())
                : (int64(23), int32(-1));
    }
}

library StorageSlot {
    struct AddressSlot {
        address value;
    }

    struct BooleanSlot {
        bool value;
    }

    struct Bytes32Slot {
        bytes32 value;
    }

    struct Uint256Slot {
        uint256 value;
    }

    /**
     * @dev Returns an `AddressSlot` with member `value` located at `slot`.
     */
    function getAddressSlot(
        bytes32 slot
    ) internal pure returns (AddressSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `BooleanSlot` with member `value` located at `slot`.
     */
    function getBooleanSlot(
        bytes32 slot
    ) internal pure returns (BooleanSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `Bytes32Slot` with member `value` located at `slot`.
     */
    function getBytes32Slot(
        bytes32 slot
    ) internal pure returns (Bytes32Slot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `Uint256Slot` with member `value` located at `slot`.
     */
    function getUint256Slot(
        bytes32 slot
    ) internal pure returns (Uint256Slot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }
}
