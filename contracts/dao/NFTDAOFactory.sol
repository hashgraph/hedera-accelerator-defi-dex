//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./FTDAOFactory.sol";

/**
 * @title NFT DAO Factory
 *
 * The contract allows to deploy NFT DAOs.
 */
contract NFTDAOFactory is FTDAOFactory {
    /**
     * @dev Checks if the contract is NFT DAO.
     */
    function _isNFTDAOInstance() internal pure virtual override returns (bool) {
        return true;
    }
}
