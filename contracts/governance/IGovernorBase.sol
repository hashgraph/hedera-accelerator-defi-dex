// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "../holder/IAssetsHolder.sol";
import "../common/ISystemRoleBasedAccess.sol";
import "../governance/ITokenHolder.sol";

interface IGovernorBase {
    function initialize(
        address _token,
        uint256 _votingDelayValue,
        uint256 _votingPeriodValue,
        IHederaService _hederaService,
        ITokenHolder _tokenHolder,
        uint256 _quorumThresholdInBsp,
        ISystemRoleBasedAccess _iSystemRoleBasedAccess
    ) external;

    function upgradeHederaService(IHederaService newHederaService) external;

    function getHederaServiceVersion() external view returns (IHederaService);
}
