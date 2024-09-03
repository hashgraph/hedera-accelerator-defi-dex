// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../common/IHederaService.sol";
import "../common/hedera/HederaResponseCodes.sol";
import "./ITokenHolder.sol";
import "./ITokenHolderFactory.sol";

/**
 * @title Token holder factory.
 *
 * The contract allows to deploy token holders contracts and track the addresses.
 */
contract TokenHolderFactory is
    ITokenHolderFactory,
    Initializable,
    OwnableUpgradeable
{
    // Token holder event tag
    string private constant TokenHolder = "ITokenHolder";
    // Hedera service event tag
    string private constant HederaService = "HederaService";

    // Token holder logic contract
    ITokenHolder private tokenHolderLogic;
    // Hedera service
    IHederaService hederaService;
    // Token holder admin
    address private admin;
    // Token address => Token holder contract
    mapping(address => ITokenHolder) private tokenToHolderContractMap;
    // All token holder contract addresses
    ITokenHolder[] tokenHolders;

    modifier ifAdmin() {
        require(
            msg.sender == admin,
            "TokenHolderFactory: Only admin can change state."
        );
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @inheritdoc ITokenHolderFactory
    function initialize(
        IHederaService _hederaService,
        ITokenHolder _tokenHolderLogic,
        address _admin
    ) public initializer {
        __Ownable_init();
        tokenHolderLogic = _tokenHolderLogic;
        hederaService = _hederaService;
        admin = _admin;
        emit LogicUpdated(address(0), address(_tokenHolderLogic), TokenHolder);
        emit LogicUpdated(address(0), address(_hederaService), HederaService);
    }

    /// @inheritdoc ITokenHolderFactory
    function getTokenHolder(address _token) public returns (ITokenHolder) {
        ITokenHolder tokenHolder = tokenToHolderContractMap[_token];

        if (address(tokenHolder) == address(0x0)) {
            tokenHolder = _createTokenHolder(_token);
            tokenToHolderContractMap[_token] = tokenHolder;
            emit TokenHolderCreated(address(_token), address(tokenHolder));
        }
        return tokenHolder;
    }

    /// @inheritdoc ITokenHolderFactory
    function upgradeTokenHolderLogicImplementation(
        ITokenHolder _newImpl
    ) public ifAdmin {
        emit LogicUpdated(
            address(tokenHolderLogic),
            address(_newImpl),
            TokenHolder
        );
        tokenHolderLogic = _newImpl;
    }

    /**
     * @dev Upgrades the current Hedera service.
     *
     * @param newHederaService The new Hedera service.
     */
    function upgradeHederaService(
        IHederaService newHederaService
    ) external onlyOwner {
        emit LogicUpdated(
            address(hederaService),
            address(newHederaService),
            HederaService
        );
        hederaService = newHederaService;
        for (uint i = 0; i < tokenHolders.length; i++) {
            ITokenHolder holder = tokenHolders[i];
            holder.upgradeHederaService(newHederaService);
        }
    }

    /**
     * @dev Returns all token holder contracts.
     */
    function getTokenHolders() external view returns (ITokenHolder[] memory) {
        return tokenHolders;
    }

    /**
     * @dev Returns the address of the current Hedera service.
     */
    function getHederaServiceVersion() external view returns (IHederaService) {
        return hederaService;
    }

    /**
     * @dev Deploys the Transparent proxy.
     *
     * @return The address of the deployd proxy.
     */
    function _createProxy() private returns (address) {
        bytes memory _data;
        return
            address(
                new TransparentUpgradeableProxy(
                    address(tokenHolderLogic),
                    admin,
                    _data
                )
            );
    }

    /**
     * @dev Deploys the Token holder contract.
     *
     * @param _token The token address.
     * @return The address of the deployd proxy.
     */
    function _createTokenHolder(address _token) private returns (ITokenHolder) {
        address proxy = _createProxy();
        ITokenHolder holder = ITokenHolder(proxy);
        holder.initialize(hederaService, _token);
        tokenHolders.push(holder);
        return holder;
    }
}
