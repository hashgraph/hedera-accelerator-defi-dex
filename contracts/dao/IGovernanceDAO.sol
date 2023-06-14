//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;
import "../governance/IGovernorTransferToken.sol";
import "../common/IHederaService.sol";

interface IGovernanceDAO {
    function initialize(
        address _admin,
        string memory _name,
        string memory _logoUrl,
        string memory _description,
        string[] memory _webLinks,
        address payable governor
    ) external;

    function getGovernorContractAddress() external view returns (address);

    function getAllProposals() external view returns (uint256[] memory);
}
