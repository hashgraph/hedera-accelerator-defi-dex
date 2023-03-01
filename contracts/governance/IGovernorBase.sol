// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "../common/IERC20.sol";
import "../common/IBaseHTS.sol";
import "../governance/IGODHolder.sol";

interface IGovernorBase {
    function initialize(
        IERC20 _token,
        uint256 _votingDelayValue,
        uint256 _votingPeriodValue,
        IBaseHTS _tokenService,
        IGODHolder _godHolder,
        uint256 _quorumThresholdInBsp
    ) external;
}
