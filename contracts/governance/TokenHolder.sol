// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../common/IHederaService.sol";
import "../common/TokenOperations.sol";
import "../common/hedera/HederaResponseCodes.sol";

import "./ITokenHolder.sol";

abstract contract TokenHolder is
    ITokenHolder,
    Initializable,
    TokenOperations,
    OwnableUpgradeable
{
    event UpdatedAmount(address indexed user, uint256 idOrAmount, uint8 caller);
    mapping(address => uint256[]) activeProposalsForUsers;
    IHederaService internal hederaService;
    address internal _token;

    function initialize(
        IHederaService _hederaService,
        address token
    ) public initializer {
        __Ownable_init();
        hederaService = _hederaService;
        _token = token;
        _associateToken(hederaService, address(this), address(_token));
    }

    function getToken() public view override returns (address) {
        return address(_token);
    }

    function addProposalForVoter(
        address voter,
        uint256 proposalId
    ) external override returns (int32) {
        uint256[] storage proposals = activeProposalsForUsers[voter];
        proposals.push(proposalId);
        return HederaResponseCodes.SUCCESS;
    }

    function getActiveProposalsForUser()
        public
        view
        returns (uint256[] memory)
    {
        return activeProposalsForUsers[msg.sender];
    }

    function removeActiveProposals(
        address[] memory voters,
        uint256 proposalId
    ) external override returns (int32) {
        for (uint256 i = 0; i < voters.length; i++) {
            uint256[] storage proposals = activeProposalsForUsers[voters[i]];
            _removeAnArrayElement(proposalId, proposals);
        }
        return HederaResponseCodes.SUCCESS;
    }

    function canUserClaimTokens() public view virtual returns (bool) {
        return activeProposalsForUsers[msg.sender].length == 0;
    }

    function upgradeHederaService(
        IHederaService newHederaService
    ) external onlyOwner {
        hederaService = newHederaService;
    }

    function getHederaServiceVersion() external view returns (IHederaService) {
        return hederaService;
    }

    function _removeAnArrayElement(
        uint256 itemToRemove,
        uint256[] storage items
    ) internal {
        uint index = items.length;
        for (uint i = 0; i < items.length; i++) {
            if (items[i] == itemToRemove) {
                index = i;
                break;
            }
        }
        if (index >= items.length) return;

        items[index] = items[items.length - 1];
        items.pop();
    }
}
