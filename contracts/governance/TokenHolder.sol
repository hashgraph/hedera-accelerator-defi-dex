// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../common/IEvents.sol";
import "../common/IHederaService.sol";
import "../common/TokenOperations.sol";
import "../common/hedera/HederaResponseCodes.sol";

import "./ITokenHolder.sol";

/**
 * @title Token Holder.
 *
 * The contract allows proposals to be added and tracked for users who hold tokens,
 * includes functionality to determine whether a user is eligible to claim tokens.
 */
abstract contract TokenHolder is
    IEvents,
    ITokenHolder,
    Initializable,
    TokenOperations,
    OwnableUpgradeable
{
    uint8 internal constant LOCKED = 1;
    uint8 internal constant UNLOCKED = 2;
    uint8 internal constant ADD = 1;
    uint8 internal constant REMOVE = 2;

    /**
     * @notice UpdatedAmount event.
     * @dev Emitted when the admin updates amount info.
     *
     * @param user The user address.
     * @param idOrAmount The id or amount to update.
     * @param operation The operation code.
     */
    event UpdatedAmount(
        address indexed user,
        uint256 idOrAmount,
        uint8 operation
    );

    /**
     * @notice CanClaimAmount event.
     * @dev Emitted when a contract adds or removes a proposal for the user.
     *
     * @param user The user address.
     * @param canClaim The bool flag if user can claim.
     * @param operation The operation code.
     */
    event CanClaimAmount(address indexed user, bool canClaim, uint8 operation);

    // Hedera service event tag
    string private constant HederaService = "HederaService";

    // Governor address => voter address => proposal ID
    mapping(address => mapping(address => mapping(uint => bool))) governorVoterProposalDetails;
    // Governor address => proposal ID => voters
    mapping(address => mapping(uint256 => address[])) governorProposalVoters;
    // Voter address => proposals
    mapping(address => uint256[]) activeProposalsForUsers;
    // Hedera service
    IHederaService internal hederaService;
    // Manageable token
    address internal _token;

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @inheritdoc ITokenHolder
    function initialize(
        IHederaService _hederaService,
        address token
    ) public initializer {
        __Ownable_init();
        hederaService = _hederaService;
        _token = token;
        _associateToken(hederaService, address(this), address(_token));
        emit LogicUpdated(address(0), address(_hederaService), HederaService);
    }

    /// @inheritdoc ITokenHolder
    function getToken() public view override returns (address) {
        return address(_token);
    }

    /// @inheritdoc ITokenHolder
    function addProposalForVoter(uint256 proposalId) external override {
        require(isContract(msg.sender), "TokenHolder: caller must be contract");
        require(
            _balanceOf(_token, msg.sender) > 0,
            "TokenHolder: insufficient balance"
        );
        address voter = tx.origin;
        governorVoterProposalDetails[msg.sender][voter][proposalId] = true;
        governorProposalVoters[msg.sender][proposalId].push(voter);
        uint256[] storage proposals = activeProposalsForUsers[voter];
        proposals.push(proposalId);
        if (proposals.length == 1) {
            emit CanClaimAmount(voter, canUserClaimTokens(voter), ADD);
        }
    }

    /**
     * @dev Returns list of active proposals for the caller.
     */
    function getActiveProposalsForUser()
        public
        view
        returns (uint256[] memory)
    {
        return activeProposalsForUsers[msg.sender];
    }

    /// @inheritdoc ITokenHolder
    function removeActiveProposals(uint256 proposalId) external override {
        require(isContract(msg.sender), "TokenHolder: caller must be contract");
        require(
            _balanceOf(_token, msg.sender) > 0,
            "TokenHolder: insufficient balance"
        );
        address[] memory voters = governorProposalVoters[msg.sender][
            proposalId
        ];
        for (uint256 i = 0; i < voters.length; i++) {
            address voter = voters[i];
            delete governorVoterProposalDetails[msg.sender][voter][proposalId];
            uint256[] storage proposals = activeProposalsForUsers[voter];
            _removeAnArrayElement(proposalId, proposals);
            if (proposals.length == 0) {
                emit CanClaimAmount(voter, canUserClaimTokens(voter), REMOVE);
            }
        }
        delete governorProposalVoters[msg.sender][proposalId];
    }

    /**
     * @dev Checks if a user can claim tokens.
     *
     * @param account The address of the user to check.
     * @return True if the user can claim tokens, false otherwise.
     */
    function canUserClaimTokens(
        address account
    ) public view virtual returns (bool) {
        return activeProposalsForUsers[account].length == 0;
    }

    /// @inheritdoc ITokenHolder
    function upgradeHederaService(
        IHederaService newHederaService
    ) external onlyOwner {
        emit LogicUpdated(
            address(hederaService),
            address(newHederaService),
            HederaService
        );
        hederaService = newHederaService;
    }

    /// @inheritdoc ITokenHolder
    function getHederaServiceVersion() external view returns (IHederaService) {
        return hederaService;
    }

    /**
     * @dev Removes an element from an array of unsigned integers.
     *
     * @param itemToRemove The item to remove from the array.
     * @param items The array from which the item will be removed.
     */
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
