//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../dao/FTDAOFactory.sol";

contract FTDAOFactoryMock is FTDAOFactory {
    function _disableInitializers() internal override {}
}
