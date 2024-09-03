//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../common/IEvents.sol";
import "../common/IErrors.sol";
import "../common/IHederaService.sol";
import "../common/FeeConfiguration.sol";
import "../common/ISystemRoleBasedAccess.sol";

import "../dao/FTDAO.sol";
import "../holder/IAssetsHolder.sol";
import "../governance/ITokenHolder.sol";
import "../governance/HederaGovernor.sol";

import "../governance/ITokenHolderFactory.sol";

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @title FTDAO Factory
 *
 * The contract allows to manage crucial contracts for the DAO and deploy a new one.
 */
contract FTDAOFactory is IErrors, IEvents, FeeConfiguration {
    /**
     * @notice DAOCreated event.
     * @dev Emitted when user creates a new DAO.
     *
     * @param tokenHolderAddress The token holder contract address.
     * @param assetsHolderAddress The asset holder contract address.
     * @param governorAddress The governor contract address.
     * @param daoAddress The DAO contract address.
     * @param inputs The DAO input parameters.
     */
    event DAOCreated(
        address tokenHolderAddress,
        address assetsHolderAddress,
        address governorAddress,
        address daoAddress,
        CreateDAOInputs inputs
    );

    string private constant DAO = "G_DAO";
    string private constant Governance = "Governance";
    string private constant AssetsHolder = "AssetsHolder";
    string private constant TokenHolderFactory = "TokenHolderFactory";
    string private constant HederaService = "HederaService";

    address[] private daos;
    address private daoLogic;
    address private governorLogic;
    address private assetsHolderLogic;
    IHederaService private hederaService;
    ITokenHolderFactory private tokenHolderFactory;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract with the required parameters.
     *
     * @param _daoLogic The addres of the DAO logic contract.
     * @param _governorLogic The address of the governor logic contract.
     * @param _assetsHolderLogic The address of the asset holder logic contract.
     * @param _hederaService The address of the Hedera service.
     * @param _feeConfig The initial fee config.
     * @param _tokenHolderFactory The address of the token holder factory.
     * @param _iSystemRoleBasedAccess The address of the roles manager contract.
     */
    function initialize(
        address _daoLogic,
        address _governorLogic,
        address _assetsHolderLogic,
        IHederaService _hederaService,
        FeeConfig memory _feeConfig,
        ITokenHolderFactory _tokenHolderFactory,
        ISystemRoleBasedAccess _iSystemRoleBasedAccess
    ) external initializer {
        __FeeConfiguration_init(_feeConfig, _iSystemRoleBasedAccess);

        daoLogic = _daoLogic;
        governorLogic = _governorLogic;
        assetsHolderLogic = _assetsHolderLogic;

        hederaService = _hederaService;

        tokenHolderFactory = _tokenHolderFactory;

        emit LogicUpdated(address(0), daoLogic, DAO);
        emit LogicUpdated(address(0), governorLogic, Governance);
        emit LogicUpdated(address(0), assetsHolderLogic, AssetsHolder);

        emit LogicUpdated(address(0), address(hederaService), HederaService);
        emit LogicUpdated(
            address(0),
            address(tokenHolderFactory),
            TokenHolderFactory
        );
    }

    /**
     * @dev Upgrades DAO logic contract.
     *
     * @param _daoLogic The addres of the new DAO logic contract.
     */
    function upgradeDAOLogicImplementation(address _daoLogic) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        emit LogicUpdated(address(daoLogic), address(_daoLogic), DAO);
        daoLogic = _daoLogic;
    }

    /**
     * @dev Upgrades the governor logic contract.
     *
     * @param _governorLogic The addres of the new governor logic contract.
     */
    function upgradeGovernorImplementation(address _governorLogic) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        emit LogicUpdated(
            address(governorLogic),
            address(_governorLogic),
            Governance
        );
        governorLogic = _governorLogic;
    }

    /**
     * @dev Upgrades the asset holder logic contract.
     *
     * @param _assetsHolderLogic The addres of the new asset holder logic contract.
     */
    function upgradeAssetHolderImplementation(
        address _assetsHolderLogic
    ) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        emit LogicUpdated(
            address(assetsHolderLogic),
            address(_assetsHolderLogic),
            AssetsHolder
        );
        assetsHolderLogic = _assetsHolderLogic;
    }

    /**
     * @dev Upgrades the token holder factory contract.
     *
     * @param _tokenHolderFactory The addres of the new token holder factory contract.
     */
    function upgradeTokenHolderFactory(
        ITokenHolderFactory _tokenHolderFactory
    ) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        emit LogicUpdated(
            address(tokenHolderFactory),
            address(_tokenHolderFactory),
            TokenHolderFactory
        );
        tokenHolderFactory = _tokenHolderFactory;
    }

    /**
     * @dev Upgrades the Hedera service implementation.
     *
     * @param _hederaService The address of the new implementation.
     */
    function upgradeHederaService(IHederaService _hederaService) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        emit LogicUpdated(
            address(hederaService),
            address(_hederaService),
            HederaService
        );
        hederaService = _hederaService;
    }

    /**
     * @dev Returns the token holder factory address.
     */
    function getTokenHolderFactoryAddress() external view returns (address) {
        return address(tokenHolderFactory);
    }

    /**
     * @dev Returns all DAO addresses.
     */
    function getDAOs() external view returns (address[] memory) {
        return daos;
    }

    /**
     * @dev Returns the Hedera service version.
     */
    function getHederaServiceVersion() external view returns (IHederaService) {
        return hederaService;
    }

    /**
     * @dev Deploys a new DAO.
     *
     * @param _createDAOInputs The struct with deployment parameters.
     * @return tokenHolderAddress The token holder contract addres.
     * @return assetsHolderAddress The asset holder contract address.
     * @return governorAddress The governor contract address.
     * @return daoAddress The deployed DAO address.
     */
    function createDAO(
        CreateDAOInputs memory _createDAOInputs
    )
        external
        payable
        returns (
            address tokenHolderAddress,
            address assetsHolderAddress,
            address governorAddress,
            address daoAddress
        )
    {
        if (address(_createDAOInputs.tokenAddress) == address(0)) {
            revert InvalidInput("DAOFactory: token address is zero");
        }
        if (_createDAOInputs.votingPeriod == 0) {
            revert InvalidInput("DAOFactory: voting period is zero");
        }
        _validateDAOWithTokenType(_createDAOInputs.tokenAddress);
        _deductFee(hederaService);
        (
            tokenHolderAddress,
            assetsHolderAddress,
            governorAddress,
            daoAddress
        ) = _createGovernanceDAOContractInstance(_createDAOInputs);
        if (!_createDAOInputs.isPrivate) {
            daos.push(daoAddress);
        }
        emit DAOCreated(
            tokenHolderAddress,
            assetsHolderAddress,
            governorAddress,
            daoAddress,
            _createDAOInputs
        );
    }

    /**
     * @dev Deploys a new Governance DAO.
     *
     * @param _createDAOInputs The struct with deployment parameters.
     * @return The token holder contract addres.
     * @return The asset holder contract address.
     * @return The governor contract address.
     * @return The deployed DAO address.
     */
    function _createGovernanceDAOContractInstance(
        CreateDAOInputs memory _createDAOInputs
    ) private returns (address, address, address, address) {
        // 0- setting up config variable
        GovernorConfig memory config;
        config.votingDelay = _createDAOInputs.votingDelay;
        config.votingPeriod = _createDAOInputs.votingPeriod;
        config.quorumThresholdInBsp = _createDAOInputs.quorumThreshold;

        // 1 - creating token holder
        ITokenHolder iTokenHolder = tokenHolderFactory.getTokenHolder(
            address(_createDAOInputs.tokenAddress)
        );

        // 2 - creating asset holder
        IAssetsHolder iAssets = IAssetsHolder(_createProxy(assetsHolderLogic));

        // 3 - creating governor
        HederaGovernor governor = HederaGovernor(
            payable(_createProxy(governorLogic))
        );
        governor.initialize(
            config,
            iTokenHolder,
            iAssets,
            hederaService,
            iSystemRoleBasedAccess
        );

        // 4 - creating dao
        FTDAO dao = FTDAO(_createProxy(daoLogic));
        dao.initialize(address(governor), _createDAOInputs);

        return (
            address(iTokenHolder),
            address(iAssets),
            address(governor),
            address(dao)
        );
    }

    /**
     * @dev Deploys the Transparent Upgradeable Proxy for the logic.
     *
     * @param _logic The logic contract address.
     * @return The deployed proxy.
     */
    function _createProxy(address _logic) private returns (address) {
        address proxyAdmin = iSystemRoleBasedAccess.getSystemUsers().proxyAdmin;
        bytes memory _data;
        return
            address(new TransparentUpgradeableProxy(_logic, proxyAdmin, _data));
    }

    /**
     * @dev Validates DAO with the token type.
     *
     * @param _tokenAddress The logic contract address.
     */
    function _validateDAOWithTokenType(address _tokenAddress) private {
        require(
            _isNFTDAOInstance() == _isNFTToken(hederaService, _tokenAddress),
            "DAOFactory: Token type & DAO type mismatch."
        );
    }

    /**
     * @dev Checks if the contract is NFT DAO.
     */
    function _isNFTDAOInstance() internal pure virtual returns (bool) {
        return false;
    }
}
