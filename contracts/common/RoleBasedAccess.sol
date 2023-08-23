//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

abstract contract RoleBasedAccess is AccessControlUpgradeable {
    uint256[10] __gap; //For future use
}
