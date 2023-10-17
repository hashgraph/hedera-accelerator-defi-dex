//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./ISystemRoleBasedAccess.sol";
import "../common/RoleBasedAccess.sol";

contract SystemRoleBasedAccess is RoleBasedAccess, ISystemRoleBasedAccess {
    bytes32 public constant CHILD_PROXY_ADMIN_ROLE =
        keccak256("CHILD_PROXY_ADMIN_ROLE");

    bytes32 public constant VAULT_ADD_REWARD_USER =
        keccak256("VAULT_ADD_REWARD_USER");

    bytes32 public constant CHANGE_EXECUTOR_USER =
        keccak256("CHANGE_EXECUTOR_USER");

    event UpdatedUsers(SystemUsers users);

    SystemUsers private systemUsers;

    function initialize(
        SystemUsers memory _systemUsers
    ) external override initializer {
        _grantRole(DEFAULT_ADMIN_ROLE, _systemUsers.superAdmin);
        _grantRole(CHILD_PROXY_ADMIN_ROLE, _systemUsers.childProxyAdmin);
        _grantRole(VAULT_ADD_REWARD_USER, _systemUsers.vaultAddRewardUser);
        _grantRole(CHANGE_EXECUTOR_USER, _systemUsers.changeExecutorUser);
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

    function checkVaultAddRewardUser(address account) public view override {
        _checkRole(VAULT_ADD_REWARD_USER, account);
    }

    function checkChangeExecutorUser(address account) external view override {
        _checkRole(CHANGE_EXECUTOR_USER, account);
    }

    function _updateSystemUsersInternally(
        SystemUsers memory _systemUsers
    ) private {
        systemUsers = _systemUsers;
        emit UpdatedUsers(systemUsers);
    }
}
