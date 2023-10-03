//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../holder/AssetsHolder.sol";

contract AssetsHolderMock is AssetsHolder {
    function _disableInitializers() internal override {}
}
