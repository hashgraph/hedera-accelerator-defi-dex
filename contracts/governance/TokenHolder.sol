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
    uint8 internal constant LOCKED = 1;
    uint8 internal constant UNLOCKED = 2;
    uint8 internal constant ADD = 1;
    uint8 internal constant REMOVE = 2;
    event UpdatedAmount(
        address indexed user,
        uint256 idOrAmount,
        uint8 operation
    );
    event CanClaimAmount(address indexed user, bool canClaim, uint8 operation);
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
        if (proposals.length == 1) {
            emit CanClaimAmount(voter, canUserClaimTokens(voter), ADD);
        }
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
            address voter = voters[i];
            uint256[] storage proposals = activeProposalsForUsers[voter];
            _removeAnArrayElement(proposalId, proposals);
            if (proposals.length == 0) {
                emit CanClaimAmount(voter, canUserClaimTokens(voter), REMOVE);
            }
        }
        return HederaResponseCodes.SUCCESS;
    }

    function canUserClaimTokens(
        address account
    ) public view virtual returns (bool) {
        return activeProposalsForUsers[account].length == 0;
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
