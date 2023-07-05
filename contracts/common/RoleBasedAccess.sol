//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract RoleBasedAccess is OwnableUpgradeable {
    address systemUser;

    modifier onlySystemUser() {
        require(
            systemUser == _msgSender(),
            "RoleBasedAccess: caller is not the system user"
        );
        _;
    }
}
