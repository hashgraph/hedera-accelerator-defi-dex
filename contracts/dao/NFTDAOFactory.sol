//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./FTDAOFactory.sol";

contract NFTDAOFactory is FTDAOFactory {
    function _isNFTDAOInstance() internal pure virtual override returns (bool) {
        return true;
    }
}
