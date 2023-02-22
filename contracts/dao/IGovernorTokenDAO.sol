//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IGovernorTokenDAO {
    function initilize(
        address _htsAddress,
        address _godHolderAddress,
        address _tokenAddress,
        address _admin,
        string calldata _name,
        uint256 _quorumThreshold,
        uint256 _votingDelay,
        uint256 _votingPeriod
    ) external;

    function getGovernorTokenTransferContractAddress()
        external
        view
        returns (address);
}
