//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../common/IErrors.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract BaseDAO is OwnableUpgradeable, IErrors {
    event NameUpdated(string previousName, string currentName);
    event WebLinkUpdated(string previousLink, string currentLink);
    event LogoUrlUpdated(string previousLogoUrl, string currentLogoUrl);

    struct Social {
        string key;
        string value;
    }

    string private _name;
    address private _admin;
    string private _logoUrl;
    Social[] private _webLinks;

    function __BaseDAO_init(
        address admin,
        string calldata name,
        string calldata logoUrl
    ) public onlyInitializing {
        if (bytes(name).length == 0) {
            revert InvalidInput("BaseDAO: name is empty");
        }
        if (address(admin) == address(0)) {
            revert InvalidInput("BaseDAO: admin address is zero");
        }
        _admin = admin;
        _name = name;
        _logoUrl = logoUrl;
        _transferOwnership(admin);
        emit NameUpdated("", _name);
        emit LogoUrlUpdated("", _logoUrl);
    }

    function addWebLink(
        string calldata _key,
        string calldata _value
    ) external onlyOwner {
        require(bytes(_key).length > 0, "BaseDAO: invalid key passed");
        require(bytes(_value).length > 0, "BaseDAO: invalid value passed");
        string memory previousLink = getCommaSeparatedSocialLinks();
        _webLinks.push(Social(_key, _value));
        emit WebLinkUpdated(previousLink, getCommaSeparatedSocialLinks());
    }

    function updateLogoURL(string calldata logoUrl) external onlyOwner {
        emit LogoUrlUpdated(_logoUrl, logoUrl);
        _logoUrl = logoUrl;
    }

    function updateName(string calldata name) external onlyOwner {
        if (bytes(name).length == 0) {
            revert InvalidInput("BaseDAO: name is empty");
        }
        emit NameUpdated(_name, name);
        _name = name;
    }

    function getDaoDetail()
        public
        view
        returns (
            string memory name,
            string memory logoUrl,
            string memory webLinks
        )
    {
        return (_name, _logoUrl, getCommaSeparatedSocialLinks());
    }

    function getCommaSeparatedSocialLinks()
        private
        view
        returns (string memory result)
    {
        uint256 count = _webLinks.length;
        for (uint i = 0; i < count; i++) {
            bool appendCommaAtLast = i < count - 1;
            Social memory social = _webLinks[i];
            result = string.concat(
                result,
                social.key,
                ",",
                social.value,
                appendCommaAtLast ? "," : ""
            );
        }
    }
}
