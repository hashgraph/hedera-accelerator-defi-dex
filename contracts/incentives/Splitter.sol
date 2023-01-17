// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../common/hedera/HederaResponseCodes.sol";
import "../common/IBaseHTS.sol";
import "./ISplitter.sol";
import "hardhat/console.sol";

contract Splitter is ISplitter, HederaResponseCodes, Initializable {
    event VaultAdded(IVault vault, uint256 multiplier);
    event TokenTransferred(IVault vault, uint256 amount);

    IBaseHTS internal _tokenService;
    IVault[] private _vaults;
    mapping(IVault => uint256) private _vaultMultipliers;
    address private _owner;

    modifier onlyOwner() {
        require(_owner == msg.sender, "Only Owner can call this function");
        _;
    }

    function initialize(
        IBaseHTS tokenService,
        IVault[] memory vaults,
        uint256[] memory multipliers
    ) public initializer {
        require(
            vaults.length == multipliers.length,
            "Splitter: vault and multipliers length mismatch"
        );
        require(vaults.length > 0, "Splitter: no vault");
        _owner = msg.sender;
        _tokenService = tokenService;
        for (uint256 i = 0; i < vaults.length; i++) {
            _addVault(vaults[i], multipliers[i]);
        }
    }

    function _addVault(
        IVault vault,
        uint256 multiplier
    ) private returns (int32) {
        require(
            address(vault) != address(0),
            "Splitter: account is the zero address"
        );
        require(multiplier > 0, "Splitter: multiplier are 0");
        require(
            _vaultMultipliers[vault] == 0,
            "Splitter: account already has shares"
        );

        _vaults.push(vault);
        _vaultMultipliers[vault] = multiplier;
        emit VaultAdded(vault, multiplier);
        return HederaResponseCodes.SUCCESS;
    }

    function splitTokensToVaults(
        address token,
        address fromAccount,
        uint256 amount
    ) external override returns (int32) {
        uint256 totalWeightForAllVaults = _totalVaultWeight();
        for (uint256 i = 0; i < _vaults.length; i++) {
            IVault tempVault = _vaults[i];
            uint256 amountToTransfer = _amountToTransfer(
                tempVault,
                amount,
                totalWeightForAllVaults
            );
            require(
                amountToTransfer != 0,
                "Splitter: Split amount should not be zero."
            );
            tempVault.addReward(token, amountToTransfer, fromAccount);
            emit TokenTransferred(tempVault, amountToTransfer);
        }
        return HederaResponseCodes.SUCCESS;
    }

    function registerVault(
        IVault vault,
        uint16 multiplier
    ) external override onlyOwner returns (int32) {
        return _addVault(vault, multiplier);
    }

    function deRegisterVault(
        IVault vault
    ) external override onlyOwner returns (int32) {
        // TODO: Need Discussion if we need this
    }

    function _amountToTransfer(
        IVault vault,
        uint256 totalAmount,
        uint256 totalWeightForAllVaults
    ) private returns (uint256 amountToTransfer) {
        uint256 percentage = _calculateTokenRewardPercentage(
            vault,
            totalWeightForAllVaults
        );
        amountToTransfer = multiply(totalAmount, percentage);
    }

    function _calculateTokenRewardPercentage(
        IVault vault,
        uint256 totalWeight
    ) private view returns (uint256) {
        uint256 vaultShareFraction = divide(_vaultWeight(vault), totalWeight);
        return vaultShareFraction;
    }

    function _totalVaultWeight() private view returns (uint256 totalWeight) {
        for (uint256 i = 0; i < _vaults.length; i++) {
            IVault tempVault = _vaults[i];
            uint256 weight = _vaultWeight(tempVault);
            totalWeight += weight;
        }
    }

    function _vaultWeight(IVault vault) private view returns (uint256 weight) {
        uint256 tokenCount = vault.getTotalVolume();
        weight = tokenCount * _vaultMultipliers[vault];
    }

    function divide(uint256 p0, uint256 p1) internal pure returns (uint256) {
        return ((p0 * getPrecisionValue()) / p1);
    }

    function multiply(uint256 p0, uint256 p1) internal pure returns (uint256) {
        return ((p0 * p1) / getPrecisionValue());
    }

    function getPrecisionValue() internal pure returns (uint256) {
        return 100000000;
    }
}
