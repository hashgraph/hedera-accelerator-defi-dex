//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../governance/NFTHolder.sol";

contract NFTHolderMock is NFTHolder {
    function _disableInitializers() internal override {}
}
