//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract RoleBasedAccess is AccessControlUpgradeable {
    bytes32 public constant PROXY_ADMIN_ROLE = keccak256("PROXY_ADMIN_ROLE");
    bytes32 public constant CHILD_PROXY_ADMIN_ROLE =
        keccak256("CHILD_PROXY_ADMIN_ROLE");

    struct SystemUsers {
        address superAdmin;
        address proxyAdmin;
        address childProxyAdmin;
    }

    SystemUsers internal systemUsers;
}
