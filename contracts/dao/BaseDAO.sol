//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../common/IErrors.sol";
import "../common/RoleBasedAccess.sol";

abstract contract BaseDAO is IErrors, RoleBasedAccess {
    bytes32 public constant DAO_ADMIN = keccak256("DAO_ADMIN");

    event DAOInfoUpdated(DAOInfo daoInfo);

    struct DAOInfo {
        string name;
        address admin;
        string logoUrl;
        string description;
        string[] webLinks;
    }

    DAOInfo private daoInfo;

    uint256[20] __baseDaoGap;//For future use

    function __BaseDAO_init(
        address _admin,
        string memory _name,
        string memory _logoUrl,
        string memory _description,
        string[] memory _webLinks
    ) public onlyInitializing {
        if (address(_admin) == address(0)) {
            revert InvalidInput("BaseDAO: admin address is zero");
        }
        daoInfo.admin = _admin;
        _grantRole(DAO_ADMIN, _admin);
        updateDaoInfoInternally(_name, _logoUrl, _description, _webLinks);
    }

    function getDaoInfo() external view returns (DAOInfo memory) {
        return daoInfo;
    }

    function updateDaoInfo(
        string memory _name,
        string memory _logoUrl,
        string memory _description,
        string[] memory _webLinks
    ) public onlyRole(DAO_ADMIN) {
        updateDaoInfoInternally(_name, _logoUrl, _description, _webLinks);
    }

    function updateDaoInfoInternally(
        string memory _name,
        string memory _logoUrl,
        string memory _description,
        string[] memory _webLinks
    ) private {
        if (bytes(_name).length == 0) {
            revert InvalidInput("BaseDAO: name is empty");
        }
        daoInfo.name = _name;

        if (bytes(_description).length == 0) {
            revert InvalidInput("BaseDAO: description is empty");
        }
        daoInfo.description = _description;

        for (uint i = 0; i < _webLinks.length; i++) {
            if (bytes(_webLinks[i]).length == 0) {
                revert InvalidInput("BaseDAO: invalid link");
            }
        }
        daoInfo.webLinks = _webLinks;

        daoInfo.logoUrl = _logoUrl;
        emit DAOInfoUpdated(daoInfo);
    }
}
