//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

interface ISystemRoleBasedAccess {
    struct SystemUsers {
        address superAdmin;
        address proxyAdmin;
        address childProxyAdmin;
    }

    function initialize(SystemUsers memory _systemUsers) external;

    function getSystemUsers() external view returns (SystemUsers memory);

    function updateSystemUsers(SystemUsers memory _systemUsers) external;

    function checkChildProxyAdminRole(address account) external view;
}
