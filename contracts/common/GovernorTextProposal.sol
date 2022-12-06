// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;
import "./GovernorCountingSimpleInternal.sol";

contract GovernorTextProposal is GovernorCountingSimpleInternal {
    using Bits for uint256;

    function createProposal (
        string memory description
    ) public returns (uint256) { 
        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas) = mockFunctionCall();
        uint256 proposalId = propose(targets, values, calldatas, description);
        return proposalId;
    } 

    function quorum(uint256)
        public
        pure
        override(IGovernorUpgradeable)
        returns (uint256)
    {
        return 1;
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
        super._execute(proposalId,targets, values, calldatas, description);
    }
}
