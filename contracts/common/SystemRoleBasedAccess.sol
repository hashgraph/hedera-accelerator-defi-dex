//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./ISystemRoleBasedAccess.sol";
import "../common/RoleBasedAccess.sol";

contract SystemRoleBasedAccess is RoleBasedAccess, ISystemRoleBasedAccess {
    bytes32 public constant CHILD_PROXY_ADMIN_ROLE =
        keccak256("CHILD_PROXY_ADMIN_ROLE");

    event UpdatedUsers(SystemUsers users);

    SystemUsers private systemUsers;

    function initialize(
        SystemUsers memory _systemUsers
    ) external override initializer {
        _grantRole(DEFAULT_ADMIN_ROLE, _systemUsers.superAdmin);
        _grantRole(CHILD_PROXY_ADMIN_ROLE, _systemUsers.childProxyAdmin);
        _updateSystemUsersInternally(_systemUsers);
    }

    function getSystemUsers()
        external
        view
        override
        returns (SystemUsers memory)
    {
        return systemUsers;
    }

    function updateSystemUsers(
        SystemUsers memory _systemUsers
    ) external override {
        checkChildProxyAdminRole(msg.sender);
        _updateSystemUsersInternally(_systemUsers);
    }

    function checkChildProxyAdminRole(address account) public view override {
        _checkRole(CHILD_PROXY_ADMIN_ROLE, account);
    }

    function _updateSystemUsersInternally(
        SystemUsers memory _systemUsers
    ) private {
        systemUsers = _systemUsers;
        emit UpdatedUsers(systemUsers);
    }
}
