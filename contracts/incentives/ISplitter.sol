// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "./IVault.sol";
import "../common/IBaseHTS.sol";

interface ISplitter {
    function initialize(
        IBaseHTS _baseHTS,
        IVault[] memory _vaults,
        uint256[] memory _multipliers
    ) external;

    function registerVault(IVault _vault, uint256 _multiplier) external;

    function deregisterVault(IVault _vault) external;

    function splitTokens(
        address _token,
        address _from,
        uint256 _amount
    ) external;
}
