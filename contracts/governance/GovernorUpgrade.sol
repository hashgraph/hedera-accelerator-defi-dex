// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;
import "./GovernorCountingSimpleInternal.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

interface ITransparentProxy {
    function upgradeTo(address forAddress) external;
}

contract GovernorUpgrade is GovernorCountingSimpleInternal {
    struct TokenUpgradeData {
        address payable proxyContract;
        address contractToUpgrade;
    }

    using Bits for uint256;
    mapping(uint256 => TokenUpgradeData) _proposalData;

    function createProposal(
        string memory description,
        address payable proxyContract,
        address contractToUpgrade
    ) public returns (uint256) {
        (
            address[] memory targets,
            uint256[] memory values,
            bytes[] memory calldatas
        ) = mockFunctionCall();
        uint256 proposalId = propose(targets, values, calldatas, description);
        TokenUpgradeData memory tokenUpgradeData = TokenUpgradeData(
            proxyContract,
            contractToUpgrade
        );
        _proposalData[proposalId] = tokenUpgradeData;
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

    function getContractAddresses(uint256 proposalId)
        public
        view
        returns (address, address)
    {
        require(
            state(proposalId) == ProposalState.Executed,
            "Contract not executed yet!"
        );
        TokenUpgradeData memory tokenUpgradeData = _proposalData[proposalId];
        return (tokenUpgradeData.proxyContract, tokenUpgradeData.contractToUpgrade);
    }
}
