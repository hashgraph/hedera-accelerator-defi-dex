//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "../common/IERC721.sol";

import "hardhat/console.sol";

contract ERC721Mock is IERC721 {
    bool private transferFailed;

    function setTransaferFailed(bool _transferFailed) public {
        transferFailed = _transferFailed;
    }

    function balanceOf(address _owner) external view returns (uint256) {}

    function ownerOf(uint256 _tokenId) external view returns (address) {}

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory data
    ) external payable {}

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) external payable {}

    function transferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) external payable {}

    function approve(address _approved, uint256 _tokenId) external payable {}

    function setApprovalForAll(address _operator, bool _approved) external {}

    function getApproved(uint256 _tokenId) external view returns (address) {}

    function isApprovedForAll(
        address _owner,
        address _operator
    ) external view returns (bool) {}
}
