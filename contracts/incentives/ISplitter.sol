// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "./IVault.sol";

interface ISplitter {
    function initialize(
        IVault[] memory _vaults,
        uint256[] memory _multipliers
    ) external;

    function getVaults() external view returns (IVault[] memory);

    function getVaultMultiplier(IVault _vault) external view returns (uint256);

    function getSplittedAmountListForGivenAmount(
        uint256 _amount
    ) external view returns (uint256[] memory);

    function registerVault(IVault _vault, uint256 _multiplier) external;

    function deregisterVault(IVault _vault) external;

    function splitTokens(
        address _token,
        address _from,
        uint256 _amount
    ) external;
}
