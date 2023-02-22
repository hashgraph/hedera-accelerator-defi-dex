//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./BaseDAO.sol";
import "./IGovernorTokenDAO.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract GovernorTokenDAO is BaseDAO, IGovernorTokenDAO {
    address private governorTokenTransferAddress;

    function initilize(
        address _htsAddress,
        address _godHolderAddress,
        address _tokenAddress,
        address _admin,
        string calldata _name,
        uint256 _quorumThreshold,
        uint256 _votingDelay,
        uint256 _votingPeriod
    ) external override initializer {
        __BaseDAO_init(_admin, _name);
    }

    function getGovernorTokenTransferContractAddress()
        external
        view
        override
        returns (address)
    {
        return governorTokenTransferAddress;
    }
}
