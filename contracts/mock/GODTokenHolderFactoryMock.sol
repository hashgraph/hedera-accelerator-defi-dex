//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../governance/GODTokenHolderFactory.sol";

contract GODTokenHolderFactoryMock is GODTokenHolderFactory {
    function _disableInitializers() internal override {}
}
