//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

interface IEvents {
    event LogicUpdated(
        address indexed oldImplementation,
        address indexed newImplementation,
        string name
    );
}
