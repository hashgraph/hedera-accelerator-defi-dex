//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../common/IErrors.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract BaseDAO is IErrors, OwnableUpgradeable {
    event DAOInfoUpdated(DAOInfo daoInfo);

    struct DAOInfo {
        string name;
        address admin;
        string logoUrl;
        string description;
        string[] webLinks;
    }

    DAOInfo private daoInfo;

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
        _transferOwnership(_admin);
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
    ) public onlyOwner {
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
