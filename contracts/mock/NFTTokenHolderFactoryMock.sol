//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../governance/NFTTokenHolderFactory.sol";

contract NFTTokenHolderFactoryMock is NFTTokenHolderFactory {
    function _disableInitializers() internal override {}
}
