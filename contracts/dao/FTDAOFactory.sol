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

contract FTDAOFactory is IErrors, IEvents, ISharedModel, FeeConfiguration {
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
    string private constant ISystemRole = "ISystemRole";

    address[] private daos;
    address private daoLogic;
    address private governorLogic;
    address private assetsHolderLogic;
    IHederaService private hederaService;
    ITokenHolderFactory private tokenHolderFactory;
    ISystemRoleBasedAccess private iSystemRoleBasedAccess;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _daoLogic,
        address _governorLogic,
        address _assetsHolderLogic,
        IHederaService _hederaService,
        FeeConfig memory _feeConfig,
        ITokenHolderFactory _tokenHolderFactory,
        ISystemRoleBasedAccess _iSystemRoleBasedAccess
    ) external initializer {
        __FeeConfiguration_init(_feeConfig);

        daoLogic = _daoLogic;
        governorLogic = _governorLogic;
        assetsHolderLogic = _assetsHolderLogic;

        hederaService = _hederaService;

        tokenHolderFactory = _tokenHolderFactory;
        iSystemRoleBasedAccess = _iSystemRoleBasedAccess;

        emit LogicUpdated(address(0), daoLogic, DAO);
        emit LogicUpdated(address(0), governorLogic, Governance);
        emit LogicUpdated(address(0), assetsHolderLogic, AssetsHolder);

        emit LogicUpdated(address(0), address(hederaService), HederaService);
        emit LogicUpdated(
            address(0),
            address(tokenHolderFactory),
            TokenHolderFactory
        );
        emit LogicUpdated(
            address(0),
            address(iSystemRoleBasedAccess),
            ISystemRole
        );
    }

    function upgradeDAOLogicImplementation(address _daoLogic) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        emit LogicUpdated(address(daoLogic), address(_daoLogic), DAO);
        daoLogic = _daoLogic;
    }

    function upgradeGovernorImplementation(address _governorLogic) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        emit LogicUpdated(
            address(governorLogic),
            address(_governorLogic),
            Governance
        );
        governorLogic = _governorLogic;
    }

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

    function upgradeHederaService(IHederaService _hederaService) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        emit LogicUpdated(
            address(hederaService),
            address(_hederaService),
            HederaService
        );
        hederaService = _hederaService;
    }

    function upgradeISystemRoleBasedAccess(
        ISystemRoleBasedAccess _iSystemRoleBasedAccess
    ) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        emit LogicUpdated(
            address(iSystemRoleBasedAccess),
            address(_iSystemRoleBasedAccess),
            ISystemRole
        );
        iSystemRoleBasedAccess = _iSystemRoleBasedAccess;
    }

    function getTokenHolderFactoryAddress() external view returns (address) {
        return address(tokenHolderFactory);
    }

    function getDAOs() external view returns (address[] memory) {
        return daos;
    }

    function getHederaServiceVersion() external view returns (IHederaService) {
        return hederaService;
    }

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
        _deductFee(hederaService);
        if (address(_createDAOInputs.tokenAddress) == address(0)) {
            revert InvalidInput("DAOFactory: token address is zero");
        }
        if (_createDAOInputs.votingPeriod == 0) {
            revert InvalidInput("DAOFactory: voting period is zero");
        }
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
            tokenHolderAddress,
            governorAddress,
            daoAddress,
            _createDAOInputs
        );
    }

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

    function _createProxy(address _logic) private returns (address) {
        address proxyAdmin = iSystemRoleBasedAccess.getSystemUsers().proxyAdmin;
        bytes memory _data;
        return
            address(new TransparentUpgradeableProxy(_logic, proxyAdmin, _data));
    }
}
