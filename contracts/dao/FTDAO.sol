//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;
import "./BaseDAO.sol";
import "./ISharedDAOModel.sol";

contract FTDAO is BaseDAO, ISharedDAOModel {
    address public governorAddress;

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
