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

    string private name;
    address private admin;
    string private logoUrl;
    Social[] private webLinks;

    function __BaseDAO_init(
        address _admin,
        string calldata _name,
        string calldata _logoUrl
    ) public onlyInitializing {
        if (address(_admin) == address(0)) {
            revert InvalidInput("BaseDAO: admin address is zero");
        }
        if (bytes(_name).length == 0) {
            revert InvalidInput("BaseDAO: name is empty");
        }
        admin = _admin;
        name = _name;
        logoUrl = _logoUrl;
        _transferOwnership(admin);
        emit NameUpdated("", name);
        emit LogoUrlUpdated("", logoUrl);
    }

    function addWebLink(
        string calldata _key,
        string calldata _value
    ) external onlyOwner {
        require(bytes(_key).length > 0, "BaseDAO: invalid key passed");
        require(bytes(_value).length > 0, "BaseDAO: invalid value passed");
        string memory previousLink = getCommaSeparatedSocialLinks();
        webLinks.push(Social(_key, _value));
        emit WebLinkUpdated(previousLink, getCommaSeparatedSocialLinks());
    }

    function updateLogoURL(string calldata _logoUrl) external onlyOwner {
        emit LogoUrlUpdated(logoUrl, _logoUrl);
        logoUrl = _logoUrl;
    }

    function updateName(string calldata _name) external onlyOwner {
        if (bytes(_name).length == 0) {
            revert InvalidInput("BaseDAO: name is empty");
        }
        emit NameUpdated(name, _name);
        name = _name;
    }

    function getDaoDetail()
        public
        view
        returns (
            string memory _name,
            string memory _logoUrl,
            string memory _webLinks
        )
    {
        return (name, logoUrl, getCommaSeparatedSocialLinks());
    }

    function getCommaSeparatedSocialLinks()
        private
        view
        returns (string memory result)
    {
        uint256 count = webLinks.length;
        for (uint i = 0; i < count; i++) {
            bool appendCommaAtLast = i < count - 1;
            Social memory social = webLinks[i];
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
