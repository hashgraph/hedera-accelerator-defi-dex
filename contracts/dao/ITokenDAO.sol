//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;
import "../governance/IGovernorTransferToken.sol";

interface ITokenDAO {
    function initialize(
        address _admin,
        string memory _name,
        string memory _logoUrl,
        string memory _description,
        string[] memory _webLinks,
        IGovernorTransferToken governor
    ) external;

    function getGovernorTokenTransferContractAddress()
        external
        view
        returns (address);

    function getAllProposals() external view returns (uint256[] memory);

    function createProposal(
        string memory _title,
        string memory _description,
        string memory _linkToDiscussion,
        address _transferFromAccount,
        address _transferToAccount,
        address _tokenToTransfer,
        uint256 _transferTokenAmount
    ) external returns (uint256);
}
