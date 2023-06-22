// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "../common/IERC20.sol";
import "../common/IHederaService.sol";
import "../governance/ITokenHolder.sol";

interface IGovernorBase {
    function initialize(
        address _token,
        uint256 _votingDelayValue,
        uint256 _votingPeriodValue,
        IHederaService _hederaService,
        ITokenHolder _tokenHolder,
        uint256 _quorumThresholdInBsp
    ) external;

    function upgradeHederaService(IHederaService newHederaService) external;
}
