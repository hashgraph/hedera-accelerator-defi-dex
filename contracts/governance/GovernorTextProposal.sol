// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;
import "./GovernorCountingSimpleInternal.sol";

contract GovernorTextProposal is GovernorCountingSimpleInternal {
    using Bits for uint256;

    function createProposal(
        string memory title,
        string memory description,
        string memory linkToDiscussion
    ) public returns (uint256) {
        uint256 proposalId = _createProposal(
            title,
            description,
            linkToDiscussion,
            msg.sender
        );
        return proposalId;
    }

    /**
     * @dev Internal execution mechanism. Can be overridden to implement different execution mechanism
     */
    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 description
    ) internal virtual override {
        super._execute(proposalId, targets, values, calldatas, description);
    }
}
