//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./BaseDAO.sol";
import "./IGovernanceDAO.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract GovernanceDAO is BaseDAO, IGovernanceDAO {
    address private governorTokenTransferContractAddress;

    function initialize(
        address _admin,
        string calldata _name,
        address _governorTokenTransferContractAddress
    ) external override initializer {
        __BaseDAO_init(_admin, _name);
        governorTokenTransferContractAddress = _governorTokenTransferContractAddress;
    }

    function getGovernorTokenTransferContractAddress()
        external
        view
        override
        returns (address)
    {
        return governorTokenTransferContractAddress;
    }
}
