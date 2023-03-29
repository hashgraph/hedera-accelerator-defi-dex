// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../common/IERC20.sol";
import "../common/IBaseHTS.sol";
import "../common/hedera/HederaResponseCodes.sol";
import "./TokenHolder.sol";

contract GODHolder is TokenHolder {
    mapping(address => uint256) godTokenForUsers;

    function balanceOfVoter(
        address voter
    ) external view override returns (uint256) {
        return godTokenForUsers[voter];
    }

    function revertTokensForVoter() external override returns (int32) {
        require(
            activeProposalsForUsers[msg.sender].length == 0,
            "User's Proposals are active"
        );
        uint256 amount = godTokenForUsers[msg.sender];
        require(amount > 0, "GODHolder: No amount for the Voter.");
        bool tranferStatus = IERC20(_token).transfer(msg.sender, amount);
        require(
            tranferStatus,
            "GODHolder: token transfer failed from contract."
        );
        delete (godTokenForUsers[msg.sender]);
        return HederaResponseCodes.SUCCESS;
    }

    function grabTokensFromUser(address user, int256) external override {
        uint256 userBalance = IERC20(_token).balanceOf(user);
        if (godTokenForUsers[user] > 0 && userBalance == 0) {
            return;
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
}
