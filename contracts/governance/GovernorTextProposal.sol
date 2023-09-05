// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;
import "./GovernorCountingSimpleInternal.sol";

contract GovernorTextProposal is GovernorCountingSimpleInternal {
    function createProposal(
        string memory title,
        string memory description,
        string memory linkToDiscussion,
        uint256 nftTokenSerialId
    ) public returns (uint256) {
        uint256 proposalId = _createProposal(
            title,
            description,
            linkToDiscussion,
            bytes(""),
            nftTokenSerialId
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
