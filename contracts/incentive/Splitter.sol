// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../common/hedera/HederaResponseCodes.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "../common/IBaseHTS.sol";
import "./ISplitter.sol";
import "hardhat/console.sol";

contract Splitter is ISplitter, HederaResponseCodes, Initializable {
    event VaultAdded(IVault vault, uint256 multiplier);

    IBaseHTS internal _tokenService;
    IVault[] private _vaults;
    mapping(IVault => uint256) private _vaultMultipliers;
    uint256 private _totalShares;
    address private owner;
    using PRBMathUD60x18 for uint256;

    modifier onlyOwner() {
        require(owner == msg.sender, "Only Owner can call this function");
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
        _tokenService = tokenService;
        for (uint256 i = 0; i < vaults.length; i++) {
            _addVault(vaults[i], multipliers[i]);
        }
        console.logUint(_vaults.length);
    }

    function _addVault(IVault vault, uint256 multiplier)
        private
        returns (int32)
    {
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
        _totalShares = _totalShares + multiplier;
        emit VaultAdded(vault, multiplier);
        return HederaResponseCodes.SUCCESS;
    }

    function splitTokensToVaults(
        address token,
        address fromAccount,
        uint256 amount
    ) external override returns (int32) {
        for (uint256 i = 0; i < _vaults.length; i++) {
            IVault tempVault = _vaults[i];
            uint256 percentage = _calculateTokenRewardPercentage(tempVault);
            uint256 amountToTransfer = multiply(amount, percentage);
            _tokenService.associateTokenPublic(address(tempVault), token);
            _tokenService.transferTokenPublic(
                token,
                fromAccount,
                address(tempVault),
                int256(amountToTransfer)
            );
        }
        return HederaResponseCodes.SUCCESS;
    }

    function registerVault(IVault vault, uint16 multiplier)
        external
        override
        onlyOwner
        returns (int32)
    {
        return _addVault(vault, multiplier);
    }

    function deRegisterVault(IVault vault) external override returns (int32) {}

    function rewardTokenPercentage(IVault vault)
        external
        override
        returns (uint256)
    {
        return _calculateTokenRewardPercentage(vault);
    }

    function _calculateTokenRewardPercentage(IVault vault)
        private
        returns (uint256)
    {
        (uint256 totalWeight, uint256 vaultWeight) = _totalWeightForVaults(
            vault
        );
        uint256 perShareReward = divide(vaultWeight, totalWeight);
        console.logUint(perShareReward);
        return perShareReward;
    }

    function _totalWeightForVaults(IVault vault)
        private
        returns (uint256 totalWeight, uint256 vaultWeight)
    {
        for (uint256 i = 0; i < _vaults.length; i++) {
            IVault tempVault = _vaults[i];
            uint256 tokenCount = tempVault.getStakedTokenCount();
            uint256 weight = tokenCount * _vaultMultipliers[tempVault];
            if (address(vault) == address(tempVault)) {
                vaultWeight = weight;
            }
            totalWeight += weight;
        }
    }

    function divide(uint256 p0, uint256 p1) internal pure returns (uint256) {
        return ((p0 * getPrecisionValue()) / p1);
    }

    function multiply(uint256 p0, uint256 p1) internal pure returns (uint256) {
        return ((p0 * p1) / getPrecisionValue());
    }

    function getPrecisionValue() public pure returns (uint256) {
        return 100000000;
    }
}
