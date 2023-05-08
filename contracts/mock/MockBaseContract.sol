//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../common/IBaseHTS.sol";
import "../common/hedera/HederaResponseCodes.sol";
import "./IERC20Mock.sol";
import "../common/IERC721.sol";
import "./ERC20Mock.sol";
import "hardhat/console.sol";

contract MockBaseHTS is IBaseHTS {
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

    function transferTokenPublic(
        address token,
        address from,
        address to,
        int256 amount
    ) external override returns (int256) {
        if (StorageSlot.getBooleanSlot(tokenTestSlot).value) {
            ERC20Mock(token).transfer(from, to, uint(amount));
        }
        return getResponseCode();
    }

    function associateTokenPublic(
        address,
        address
    ) external override returns (int256) {
        return getResponseCode();
    }

    function associateTokensPublic(
        address,
        address[] memory
    ) external override returns (int256) {
        return getResponseCode();
    }

    function mintTokenPublic(
        address tokenAddress,
        int256 amount
    ) external view override returns (int256, int256) {
        string memory tokenName = ERC20Mock(tokenAddress).name();
        if (isFailureToken(tokenName)) {
            return (23, amount);
        } else {
            return (22, amount);
        }
    }

    function burnTokenPublic(
        address tokenAddress,
        int256 amount
    ) external view override returns (int256, int256) {
        string memory tokenName = ERC20Mock(tokenAddress).name();
        if (isFailureToken(tokenName)) {
            return (23, amount);
        } else {
            return (22, amount);
        }
    }

    function createFungibleTokenPublic(
        IHederaTokenService.HederaToken memory tokenToCreate,
        uint256,
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
                new ERC20Mock(tokenToCreate.name, tokenToCreate.symbol, 10, 10)
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

    function hbarxAddress() external pure override returns (address) {
        return address(0x0);
    }

    function transferHBAR(
        address payable
    ) external payable override returns (bool) {
        return getResponseCode() == int(22) ? true : false;
    }

    function transferNFTPublic(
        address token,
        address sender,
        address receiver,
        int64 serial
    ) external override returns (int256) {
        if (StorageSlot.getBooleanSlot(tokenTestSlot).value) {
            IERC721(token).transferFrom(
                sender,
                receiver,
                uint256(int256(serial))
            );
        }
        return getResponseCode();
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
