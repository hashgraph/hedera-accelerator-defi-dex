// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;
import "../common/IERC20.sol";
import "../common/IHederaService.sol";

/**
 * @title The interface for the Token Holder contract.
 */
interface ITokenHolder {
    /**
     * @dev Initializes the contract with the required parameters.
     *
     * @param hederaService The address of the Hedera service.
     * @param token The address of the token to be managed.
     */
    function initialize(IHederaService hederaService, address token) external;

    /**
     * @dev Reverts the NFT tokens associated with the voter.
     * Emits an `UpdatedAmount` event after the token is returned.
     *
     * @param idOrAmount The ID or amount of the token to revert.
     * @return int32 The status code indicating success or failure of the operation.
     */
    function revertTokensForVoter(uint256 idOrAmount) external returns (int32);

    /**
     * @dev Returns the voter balance.
     *
     * @param voter The voter address.
     */
    function balanceOfVoter(address voter) external view returns (uint256);

    /**
     * @dev Locks an NFT token from the user for governance participation.
     * Emits an `UpdatedAmount` event after the token is locked.
     *
     * @param idOrAmount The ID or amount of the token to lock.
     */
    function grabTokensFromUser(uint256 idOrAmount) external;

    /**
     * @dev Adds new proposal for the user.
     *
     * @param proposalId The proposal ID.
     */
    function addProposalForVoter(uint256 proposalId) external;

    /**
     * @dev Removes the proposal with passed ID.
     *
     * @param proposalId The proposal ID.
     */
    function removeActiveProposals(uint256 proposalId) external;

    /**
     * @dev Returns the manageable token.
     */
    function getToken() external view returns (address);

    /**
     * @dev Checks the type of a holder contract.
     */
    function isNFTType() external view returns (bool);

    /**
     * @dev Upgrades the current Hedera service.
     *
     * @param newHederaService The new Hedera service.
     */
    function upgradeHederaService(IHederaService newHederaService) external;

    /**
     * @dev Returns the address of the current Hedera service.
     */
    function getHederaServiceVersion() external view returns (IHederaService);
}
