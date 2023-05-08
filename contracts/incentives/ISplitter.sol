// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "./IVault.sol";

interface ISplitter {
    function splitTokensToVaults(
        address token,
        address fromAccount,
        uint256 amount
    ) external returns (int32);

    function registerVault(
        IVault vault,
        uint16 multiplier
    ) external returns (int32);

    function deRegisterVault(IVault vault) external returns (int32);
}
