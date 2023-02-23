// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;
import "../common/IERC20.sol";
import "../common/IBaseHTS.sol";
import "../governance/IGODHolder.sol";

interface IGovernorTransferToken {
    function initialize(
        IERC20 _token,
        uint256 _votingDelayValue,
        uint256 _votingPeriodValue,
        IBaseHTS _tokenService,
        IGODHolder _godHolder,
        uint256 _quorumThresholdInBsp
    ) external;

    function createProposal(
        string memory title,
        string memory description,
        string memory linkToDiscussion,
        address transferFromAccount,
        address transferToAccount,
        address tokenToTransfer,
        int256 transferTokenAmount
    ) external returns (uint256);
}
