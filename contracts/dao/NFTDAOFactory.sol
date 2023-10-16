//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./FTDAOFactory.sol";

contract NFTDAOFactory is FTDAOFactory {
    function _isNFTDAOInstance() internal virtual override pure returns(bool) {
        return true;
    } 
}
