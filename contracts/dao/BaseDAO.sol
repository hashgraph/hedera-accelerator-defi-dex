//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

struct Social {
    uint8 key;
    string value;
}

abstract contract BaseDAO is OwnableUpgradeable {
    address private admin;
    string private name;

    address[] private members;

    Social[] private webLinks;

    function __BaseDAO_init(
        address _admin,
        string calldata _name
    ) public onlyInitializing {
        admin = _admin;
        name = _name;
        _transferOwnership(admin);
    }

    function addMember(address _member) external onlyOwner {
        members.push(_member);
    }

    function addWebLink(uint8 _key, string calldata _value) external onlyOwner {
        require(_key > 0, "BaseDAO: invalid key passed");
        require(bytes(_value).length > 0, "BaseDAO: invalid value passed");
        webLinks.push(Social(_key, _value));
    }

    function getMembers() external view returns (address[] memory) {
        return members;
    }

    function _createProxy(
        address _logic,
        address _admin
    ) internal returns (address) {
        bytes memory _data;
        return address(new TransparentUpgradeableProxy(_logic, _admin, _data));
    }
}
