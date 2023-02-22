//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

struct Social {
    uint8 key;
    string value;
}

abstract contract BaseDAO is OwnableUpgradeable {
    error AuthenticationError(string message, address sender);

    address internal _admin;
    string internal _name;
    address[] internal _members;
    Social[] internal _webLinks;
    string internal _logoUrl;

    function __BaseDAO_init(
        address admin,
        string calldata name,
        string calldata logoUrl
    ) public onlyInitializing {
        _admin = admin;
        _name = name;
        _logoUrl = logoUrl;
        _transferOwnership(admin);
    }

    function addMember(address _member) external onlyOwner {
        _members.push(_member);
    }

    function addWebLink(uint8 _key, string calldata _value) external onlyOwner {
        require(_key > 0, "BaseDAO: invalid key passed");
        require(bytes(_value).length > 0, "BaseDAO: invalid value passed");
        _webLinks.push(Social(_key, _value));
    }

    function getMembers() external view returns (address[] memory) {
        return _members;
    }

    function getDaoDetail()
        public
        returns (
            string memory name,
            string memory logoUrl,
            Social[] memory webLinks
        )
    {
        return (_name, _logoUrl, _webLinks);
    }
}
