// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../common/IERC20.sol";
import "../common/IBaseHTS.sol";
import "../common/hedera/HederaResponseCodes.sol";
import "./IGODHolder.sol";

contract GODHolder is IGODHolder, Initializable {
    mapping(address => uint256) godTokenForUsers;
    mapping(address => uint256[]) activeProposalsForUsers;
    IBaseHTS private _tokenService;
    IERC20 private _token;

    function initialize(
        IBaseHTS tokenService,
        IERC20 token
    ) public initializer {
        _tokenService = tokenService;
        _token = token;
    }

    function balanceOfVoter(
        address voter
    ) external view override returns (uint256) {
        return godTokenForUsers[voter];
    }

    function addProposalForVoter(
        address voter,
        uint256 proposalId
    ) external override returns (int32) {
        uint256[] storage proposals = activeProposalsForUsers[voter];
        proposals.push(proposalId);
        return HederaResponseCodes.SUCCESS;
    }

    function getActiveProposalsForUser()
        public
        view
        returns (uint256[] memory)
    {
        return activeProposalsForUsers[msg.sender];
    }

    function removeActiveProposals(
        address[] memory voters,
        uint256 proposalId
    ) external override returns (int32) {
        for (uint256 i = 0; i < voters.length; i++) {
            uint256[] storage proposals = activeProposalsForUsers[voters[i]];
            _removeAnArrayElement(proposalId, proposals);
        }
        return HederaResponseCodes.SUCCESS;
    }

    function canUserClaimGodTokens() external view returns (bool) {
        return activeProposalsForUsers[msg.sender].length == 0;
    }

    function revertTokensForVoter() external override returns (int32) {
        require(
            activeProposalsForUsers[msg.sender].length == 0,
            "User's Proposals are active"
        );
        uint256 amount = godTokenForUsers[msg.sender];
        require(amount > 0, "GODHolder: No amount for the Voter.");
        bool tranferStatus = _token.transfer(msg.sender, amount);
        require(
            tranferStatus,
            "GODHolder: token transfer failed from contract."
        );
        delete (godTokenForUsers[msg.sender]);
        return HederaResponseCodes.SUCCESS;
    }

    function grabTokensFromUser(
        address user
    ) external override returns (uint256 amount) {
        uint256 userBalance = _token.balanceOf(user);
        if (godTokenForUsers[user] > 0 && userBalance == 0) {
            return godTokenForUsers[user];
        }
        godTokenForUsers[user] += userBalance;
        _tokenService.associateTokenPublic(address(this), address(_token));
        int256 responseCode = _tokenService.transferTokenPublic(
            address(_token),
            address(user),
            address(this),
            int256(userBalance)
        );
        require(
            responseCode == HederaResponseCodes.SUCCESS,
            "GODHolder: token transfer failed to contract."
        );
    }

    function _removeAnArrayElement(
        uint256 itemToRemove,
        uint256[] storage items
    ) internal {
        uint index = items.length;
        for (uint i = 0; i < items.length; i++) {
            if (items[i] == itemToRemove) {
                index = i;
                break;
            }
        }
        if (index >= items.length) return;

        items[index] = items[items.length - 1];
        items.pop();
    }
}
