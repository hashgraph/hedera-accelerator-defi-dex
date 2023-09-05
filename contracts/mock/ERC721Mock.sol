//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./ITokenType.sol";
import "../common/IERC721.sol";

contract ERC721Mock is IERC721, ITokenType {
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;

    function setUserBalance(address to, uint256 tokenId) external {
        require(_owners[tokenId] == address(0), "ERC721: token already minted");
        _owners[tokenId] = to;
        _balances[to] += 1;
    }

    function balanceOf(
        address owner
    ) public view virtual override returns (uint256) {
        return _balances[owner];
    }

    function ownerOf(
        uint256 tokenId
    ) public view virtual override returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "ERC721: invalid token ID");
        return owner;
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) external {
        safeTransferFrom(_from, _to, _tokenId, "");
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory
    ) public {
        transferFrom(_from, _to, _tokenId);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;
    }

    function approve(address _approved, uint256 _tokenId) external {}

    function setApprovalForAll(address _operator, bool _approved) external {}

    function getApproved(uint256 _tokenId) external view returns (address) {}

    function isApprovedForAll(
        address _owner,
        address _operator
    ) external view returns (bool) {}

    function tokenType() external pure override returns (int32) {
        return 1;
    }
}
