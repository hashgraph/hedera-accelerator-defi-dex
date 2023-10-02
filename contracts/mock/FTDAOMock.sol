//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../dao/FTDAO.sol";

contract FTDAOMock is FTDAO {
    function _disableInitializers() internal override {}
}
