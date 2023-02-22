//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IGovernanceDAO {
    function initialize(
        address _admin,
        string calldata _name,
        address _governorTokenTransferContractAddress
    ) external;

    function getGovernorTokenTransferContractAddress()
        external
        view
        returns (address);
}
