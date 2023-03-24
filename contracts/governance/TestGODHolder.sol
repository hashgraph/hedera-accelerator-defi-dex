// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;
import "./GODHolder.sol";

contract TestGODHolder is GODHolder {
    function revertTokensForVoterForcefully() external returns (int32) {
        uint256 amount = godTokenForUsers[msg.sender];
        require(amount > 0, "GODHolder: No amount for the Voter.");
        bool tranferStatus = getGODToken().transfer(msg.sender, amount);
        require(
            tranferStatus,
            "GODHolder: token transfer failed from contract."
        );
        delete (godTokenForUsers[msg.sender]);
        return HederaResponseCodes.SUCCESS;
    }
}
