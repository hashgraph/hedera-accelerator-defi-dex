//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../Pair.sol";

contract MockPair is Pair {
    function _disableInitializers() internal override {}
}
