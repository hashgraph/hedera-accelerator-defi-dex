//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "../common/IERC721.sol";

import "hardhat/console.sol";

contract ERC721Mock is IERC721 {
    bool private transferFailed;
    mapping(address => uint256) userBalances;
    mapping(uint256 => address) userTokenIds;
    int failTransferAfterCount;
    bool isFailTransferAfterCountEnabled;

    function setTransaferFailed(bool _transferFailed) public {
        transferFailed = _transferFailed;
    }

    function balanceOf(address _owner) external view returns (uint256) {
        return userBalances[_owner];
    }

    function setUserBalance(address _user, uint256 _userBalance) external {
        userBalances[_user] = _userBalance;
    }

    function ownerOf(uint256 _tokenId) external view returns (address) {
        return userTokenIds[_tokenId];
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory data
    ) external payable {
        userTokenIds[_tokenId] = _from;
        userBalances[_from] -= (userBalances[_from] > 0 ? 1 : 0);
        userBalances[_to] += 1;
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) external payable {
        userTokenIds[_tokenId] = _from;
        userBalances[_from] -= (userBalances[_from] > 0 ? 1 : 0);
        userBalances[_to] += 1;
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) external payable {
        console.log(" transferFrom called");
        userTokenIds[_tokenId] = _from;
        userBalances[_from] -= (userBalances[_from] > 0 ? 1 : 0);
        userBalances[_to] += 1;
    }

    function approve(address _approved, uint256 _tokenId) external payable {}

    function setApprovalForAll(address _operator, bool _approved) external {}

    function getApproved(uint256 _tokenId) external view returns (address) {}

    function isApprovedForAll(
        address _owner,
        address _operator
    ) external view returns (bool) {}
}
