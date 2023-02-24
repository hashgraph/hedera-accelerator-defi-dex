//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

struct Social {
    string key;
    string value;
}

abstract contract BaseDAO is OwnableUpgradeable {
    address internal _admin;
    string internal _name;
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

    function addWebLink(
        string calldata _key,
        string calldata _value
    ) external onlyOwner {
        require(bytes(_key).length > 0, "BaseDAO: invalid key passed");
        require(bytes(_value).length > 0, "BaseDAO: invalid value passed");
        _webLinks.push(Social(_key, _value));
    }

    function getWebLinks() external view returns (Social[] memory) {
        return _webLinks;
    }

    function getDaoDetail()
        public
        view
        returns (
            string memory name,
            string memory logoUrl,
            Social[] memory webLinks
        )
    {
        return (_name, _logoUrl, _webLinks);
    }
}
