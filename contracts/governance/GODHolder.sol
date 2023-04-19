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

    function revertTokensForVoter(
        uint256 _amount
    ) external payable override returns (int32) {
        require(
            _amount > 0,
            "GODHolder: unlock amount must be a positive number"
        );
        require(
            activeProposalsForUsers[msg.sender].length == 0,
            "User's Proposals are active"
        );
        uint256 balance = godTokenForUsers[msg.sender];
        require(
            balance >= _amount,
            "GODHolder: unlock amount can't be greater to the locked amount"
        );
        godTokenForUsers[msg.sender] -= _amount;
        require(
            IERC20(_token).transfer(msg.sender, _amount),
            "GODHolder: token transfer failed from contract."
        );
        if (godTokenForUsers[msg.sender] == 0) {
            delete (godTokenForUsers[msg.sender]);
        }
        return HederaResponseCodes.SUCCESS;
    }

    function grabTokensFromUser(
        address user,
        uint256 _amount
    ) external override {
        require(
            _amount > 0,
            "GODHolder: lock amount must be a positive number"
        );
        uint256 balance = IERC20(_token).balanceOf(user);
        require(
            balance > 0,
            "GODHolder: balance amount must be a positive number"
        );
        require(
            _amount <= balance,
            "GODHolder: lock amount can't be greater to the balance amount"
        );
        godTokenForUsers[user] += _amount;
        int256 code = _tokenService.transferTokenPublic(
            address(_token),
            address(user),
            address(this),
            int256(_amount)
        );
        require(
            code == HederaResponseCodes.SUCCESS,
            "GODHolder: token transfer failed to contract."
        );
    }

    function canUserClaimTokens() public view override returns (bool) {
        return super.canUserClaimTokens() && godTokenForUsers[msg.sender] > 0;
    }

    function isNFTType() external pure returns (bool) {
        return false;
    }
}
