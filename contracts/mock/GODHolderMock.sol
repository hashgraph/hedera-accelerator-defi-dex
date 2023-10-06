//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../governance/GODHolder.sol";

contract GODHolderMock is GODHolder {
    function _disableInitializers() internal override {}
}
