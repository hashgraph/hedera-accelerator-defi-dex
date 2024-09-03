//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../common/IErrors.sol";
import "../common/RoleBasedAccess.sol";

/**
 * @title Base DAO
 *
 * The contract allows to manage a DAO info.
 */
abstract contract BaseDAO is IErrors, RoleBasedAccess {
    // The role hash
    bytes32 public constant DAO_ADMIN = keccak256("DAO_ADMIN");

    /**
     * @notice DAOInfoUpdated event.
     * @dev Emitted when the admin updates DAO info.
     *
     * @param daoInfo The DAO info struct.
     */
    event DAOInfoUpdated(DAOInfo daoInfo);

    // DAO info struct
    struct DAOInfo {
        string name;
        address admin;
        string logoUrl;
        string infoUrl;
        string description;
        string[] webLinks;
    }

    // Current DAO info
    DAOInfo private daoInfo;

    uint256[45] __baseDaoGap; //For future use

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract with the required parameters.
     *
     * @param _admin The admin address.
     * @param _name The DAO name.
     * @param _logoUrl The DAO logo URL.
     * @param _infoUrl The DAO info URL.
     * @param _description The DAO description.
     * @param _webLinks The DAO web links.
     */
    function __BaseDAO_init(
        address _admin,
        string memory _name,
        string memory _logoUrl,
        string memory _infoUrl,
        string memory _description,
        string[] memory _webLinks
    ) public onlyInitializing {
        if (address(_admin) == address(0)) {
            revert InvalidInput("BaseDAO: admin address is zero");
        }
        daoInfo.admin = _admin;
        _grantRole(DAO_ADMIN, _admin);
        updateDaoInfoInternally(
            _name,
            _logoUrl,
            _infoUrl,
            _description,
            _webLinks
        );
    }

    /**
     * @dev Returns current DAO info.
     */
    function getDaoInfo() external view returns (DAOInfo memory) {
        return daoInfo;
    }

    /**
     * @dev Updates the DAO info.
     *
     * @param _name The DAO name.
     * @param _logoUrl The DAO logo URL.
     * @param _infoUrl The DAO info URL.
     * @param _description The DAO description.
     * @param _webLinks The DAO web links.
     */
    function updateDaoInfo(
        string memory _name,
        string memory _logoUrl,
        string memory _infoUrl,
        string memory _description,
        string[] memory _webLinks
    ) public onlyRole(DAO_ADMIN) {
        updateDaoInfoInternally(
            _name,
            _logoUrl,
            _infoUrl,
            _description,
            _webLinks
        );
    }

    /**
     * @dev Updates the DAO info.
     *
     * @param _name The DAO name.
     * @param _logoUrl The DAO logo URL.
     * @param _infoUrl The DAO info URL.
     * @param _description The DAO description.
     * @param _webLinks The DAO web links.
     */
    function updateDaoInfoInternally(
        string memory _name,
        string memory _logoUrl,
        string memory _infoUrl,
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

        if (bytes(_infoUrl).length == 0) {
            revert InvalidInput("BaseDAO: info url is empty");
        }
        daoInfo.infoUrl = _infoUrl;

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
