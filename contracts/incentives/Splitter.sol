// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "./ISplitter.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Splitter is ISplitter, OwnableUpgradeable {
    using PRBMathUD60x18 for uint256;

    event VaultAdded(IVault vault, uint256 multiplier);
    event TokenTransferred(IVault vault, uint256 amount);

    IVault[] private vaults;
    IBaseHTS private baseHTS;
    mapping(IVault => uint256) private vaultMultipliers;

    function initialize(
        IBaseHTS _baseHTS,
        IVault[] memory _vaults,
        uint256[] memory _multipliers
    ) external override initializer {
        __Ownable_init();
        require(
            _vaults.length == _multipliers.length && _vaults.length > 0,
            "Splitter: vaults and multipliers length must be greater than zero"
        );
        baseHTS = _baseHTS;
        for (uint256 i = 0; i < _vaults.length; i++) {
            _addVault(_vaults[i], _multipliers[i]);
        }
    }

    function getVaults() external view override returns (IVault[] memory) {
        return vaults;
    }

    function getVaultMultiplier(
        IVault _vault
    ) external view override returns (uint256) {
        return vaultMultipliers[_vault];
    }

    function registerVault(
        IVault _vault,
        uint256 _multiplier
    ) external override onlyOwner {
        _addVault(_vault, _multiplier);
    }

    function deregisterVault(IVault _vault) external override onlyOwner {}

    function getSplittedAmountListForGivenAmount(
        uint256 _amount
    ) public view override returns (uint256[] memory splittedAmountList) {
        uint256 totalVaultWeight = getTotalVaultWeight();
        splittedAmountList = new uint256[](vaults.length);
        for (uint256 i = 0; i < vaults.length; i++) {
            splittedAmountList[i] = getAmountToTransfer(
                vaults[i],
                _amount,
                totalVaultWeight
            );
        }
    }

    function splitTokens(
        address _token,
        address _from,
        uint256 _amount
    ) external override {
        uint256[] memory amountList = getSplittedAmountListForGivenAmount(
            _amount
        );
        for (uint256 i = 0; i < amountList.length; i++) {
            vaults[i].addReward(_token, amountList[i], _from);
            emit TokenTransferred(vaults[i], amountList[i]);
        }
    }

    function _addVault(IVault _vault, uint256 _multiplier) private {
        require(
            address(_vault) != address(0),
            "Splitter: vault address should not be zero"
        );
        require(
            _multiplier > 0,
            "Splitter: multiplier should be a positive number"
        );
        require(
            vaultMultipliers[_vault] == 0,
            "Splitter: vault already registered"
        );

        vaults.push(_vault);
        vaultMultipliers[_vault] = _multiplier;
        emit VaultAdded(_vault, _multiplier);
    }

    function getAmountToTransfer(
        IVault _vault,
        uint256 _totalAmount,
        uint256 _totalVaultWeight
    ) private view returns (uint256) {
        uint256 vaultWeight = getVaultWeight(_vault);
        uint256 percentage = vaultWeight.div(_totalVaultWeight);
        return _totalAmount.mul(percentage);
    }

    function getTotalVaultWeight() private view returns (uint256 totalWeight) {
        for (uint256 i = 0; i < vaults.length; i++) {
            totalWeight += getVaultWeight(vaults[i]);
        }
    }

    function getVaultWeight(IVault _vault) private view returns (uint256) {
        return _vault.getTotalVolume() * vaultMultipliers[_vault];
    }
}
