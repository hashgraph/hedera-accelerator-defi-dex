// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;
import "./GovernorCountingSimpleInternal.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

interface ITransparentProxy {
    function upgradeTo(address forAddress) external;
}

contract GovernorUpgrade is GovernorCountingSimpleInternal {
    using Bits for uint256;

    address payable proxyContract;
    address contractToUpgrade;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        IERC20 _token,
        address payable _proxyContract,
        address _contractToUpgrade,
        uint256 _votingDelayValue,
        uint256 _votingPeriodValue
    ) public initializer {
        token = _token;
        precision = 10000000;
        proxyContract = _proxyContract;
        contractToUpgrade = _contractToUpgrade;

        __Governor_init("HederaGovernor");
        __GovernorSettings_init(
            _votingDelayValue, /* 1 block */
            _votingPeriodValue, /* 1 week */
            0
        );
        __GovernorCountingSimple_init();
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
        uint256, /* proposalId */
        address[] memory,
        uint256[] memory,
        bytes[] memory,
        bytes32 /*descriptionHash*/
    ) internal virtual override {}

    function getContractAddresses(uint256 proposalId) public view returns(address, address) {
        require(state(proposalId) == ProposalState.Executed, "Contract not executed yet!");
        return (proxyContract, contractToUpgrade);
    }
}
