//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;
import "./BaseDAO.sol";
import "../common/ISharedModel.sol";

/**
 * @title FTDAO
 */
contract FTDAO is BaseDAO, ISharedModel {
    // Governor address
    address public governorAddress;

    /**
     * @dev Initializes the contract with the required parameters.
     *
     * @param _governorAddress The governor address.
     * @param _inputs The base DAO struct.
     */
    function initialize(
        address _governorAddress,
        CreateDAOInputs memory _inputs
    ) external initializer {
        governorAddress = _governorAddress;
        __BaseDAO_init(
            _inputs.admin,
            _inputs.name,
            _inputs.logoUrl,
            _inputs.infoUrl,
            _inputs.description,
            _inputs.webLinks
        );
    }
}
