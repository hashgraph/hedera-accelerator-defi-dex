//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../common/IErrors.sol";
import "../common/CommonOperations.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract BaseDAO is IErrors, CommonOperations, OwnableUpgradeable {
    event NameUpdated(string previousName, string currentName);
    event WebLinkUpdated(string previousLink, string currentLink);
    event LogoUrlUpdated(string previousLogoUrl, string currentLogoUrl);
    event DescriptionUpdated(string previousDesc, string currentDesc);

    string private name;
    address private admin;
    string private logoUrl;
    string private description;
    string[] private webLinks;

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
        if (bytes(_name).length == 0) {
            revert InvalidInput("BaseDAO: name is empty");
        }
        if (bytes(_description).length == 0) {
            revert InvalidInput("BaseDAO: description is empty");
        }
        if (isOddLengthArray(_webLinks)) {
            revert InvalidInput("BaseDAO: links must be even length array");
        }
        admin = _admin;
        name = _name;
        logoUrl = _logoUrl;
        description = _description;
        _transferOwnership(admin);
        _addWebLinksInternally(_webLinks);
        emit NameUpdated("", name);
        emit LogoUrlUpdated("", logoUrl);
        emit DescriptionUpdated("", description);
    }

    function addWebLink(
        string memory _key,
        string memory _value
    ) external onlyOwner {
        string memory previousLinks = join(webLinks, ",");
        _addWebLinkInternally(_key, _value);
        string memory currentLinks = join(webLinks, ",");
        emit WebLinkUpdated(previousLinks, currentLinks);
    }

    function updateLogoURL(string memory _logoUrl) external onlyOwner {
        emit LogoUrlUpdated(logoUrl, _logoUrl);
        logoUrl = _logoUrl;
    }

    function updateName(string memory _name) external onlyOwner {
        if (bytes(_name).length == 0) {
            revert InvalidInput("BaseDAO: name is empty");
        }
        emit NameUpdated(name, _name);
        name = _name;
    }

    function updateDescription(string memory _desc) external onlyOwner {
        if (bytes(_desc).length == 0) {
            revert InvalidInput("BaseDAO: description is empty");
        }
        emit DescriptionUpdated(description, _desc);
        description = _desc;
    }

    function getDaoDetail()
        public
        view
        returns (
            string memory _name,
            string memory _logoUrl,
            string memory _webLinks,
            string memory _description,
            address _admin
        )
    {
        return (name, logoUrl, join(webLinks, ","), description, admin);
    }

    function _addWebLinksInternally(string[] memory _webLinks) private {
        string memory previousLinks = join(webLinks, ",");
        for (uint256 i = 0; i < _webLinks.length; i = i + 2) {
            string memory key = _webLinks[i];
            string memory value = _webLinks[i + 1];
            _addWebLinkInternally(key, value);
        }
        string memory currentLinks = join(webLinks, ",");
        emit WebLinkUpdated(previousLinks, currentLinks);
    }

    function _addWebLinkInternally(
        string memory _key,
        string memory _value
    ) private {
        require(bytes(_key).length > 0, "BaseDAO: invalid key passed");
        require(bytes(_value).length > 0, "BaseDAO: invalid value passed");
        webLinks.push(_key);
        webLinks.push(_value);
    }
}
