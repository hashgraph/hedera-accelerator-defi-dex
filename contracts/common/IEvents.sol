//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

interface IEvents {
    event LogicUpdated(
        address indexed oldImplementation,
        address indexed newImplementation,
        string name
    );
    event PublicDaoCreated(address daoAddress);
    event PrivateDaoCreated(address daoAddress);
}
