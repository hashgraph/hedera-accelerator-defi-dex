// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../common/IERC721.sol";
import "../common/hedera/HederaResponseCodes.sol";
import "./TokenHolder.sol";

/**
 * @title NFT Holder.
 *
 * The contract is designed to extend the functionality of the TokenHolder contract
 * specifically for managing NFTs in a governance system.
 */
contract NFTHolder is TokenHolder {
    // Voter address => balance
    mapping(address => uint256) nftTokenForUsers;

    /// @inheritdoc ITokenHolder
    function balanceOfVoter(
        address voter
    ) external view override returns (uint256) {
        return nftTokenForUsers[voter] > 0 ? 1 : 0;
    }

    /// @inheritdoc ITokenHolder
    function revertTokensForVoter(uint256) external override returns (int32) {
        require(
            activeProposalsForUsers[msg.sender].length == 0,
            "User's Proposals are active"
        );
        uint256 tokenId = nftTokenForUsers[msg.sender];
        require(tokenId > 0, "NFTHolder: No amount for the Voter.");
        delete (nftTokenForUsers[msg.sender]);
        _transferToken(
            hederaService,
            address(_token),
            address(this),
            msg.sender,
            tokenId
        );
        emit UpdatedAmount(msg.sender, nftTokenForUsers[msg.sender], UNLOCKED);
        return HederaResponseCodes.SUCCESS;
    }

    /// @inheritdoc ITokenHolder
    function grabTokensFromUser(uint256 tokenId) external override {
        address user = msg.sender;
        if (nftTokenForUsers[user] > 0) {
            return;
        }
        nftTokenForUsers[user] = tokenId;
        _transferToken(
            hederaService,
            address(_token),
            address(user),
            address(this),
            tokenId
        );
        emit UpdatedAmount(user, nftTokenForUsers[user], LOCKED);
    }

    /**
     * @dev Checks if a user can claim tokens.
     *
     * @param account The address of the user to check.
     * @return True if the user can claim tokens, false otherwise.
     */
    function canUserClaimTokens(
        address account
    ) public view override returns (bool) {
        return
            super.canUserClaimTokens(account) && nftTokenForUsers[account] > 0;
    }

    /// @inheritdoc ITokenHolder
    function isNFTType() external pure returns (bool) {
        return true;
    }
}
