//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../common/IEvents.sol";
import "../common/IErrors.sol";
import "../common/ISharedModel.sol";
import "../common/IHederaService.sol";
import "../common/FeeConfiguration.sol";

import "../dao/MultisigDAO.sol";

import "../gnosis/HederaMultiSend.sol";
import "../gnosis/HederaGnosisSafe.sol";
import "../gnosis/HederaGnosisSafeProxyFactory.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @title MultiSig DAO Factory
 *
 * The contract allows to deploy multisig DAOs.
 */
contract MultisigDAOFactory is
    IErrors,
    IEvents,
    Initializable,
    FeeConfiguration
{
    /**
     * @notice DAOCreated event.
     * @dev Emitted when user creates a new DAO.
     *
     * @param daoAddress The created DAO address.
     * @param safeAddress The Hedera gnosis safe contract address.
     * @param multiSendAddress The Hedera multisend contract address.
     * @param inputs The DAO input parameters.
     */
    event DAOCreated(
        address daoAddress,
        address safeAddress,
        address multiSendAddress,
        MultiSigCreateDAOInputs inputs
    );

    bytes private constant NO_DATA = "";
    string private constant DaoLogic = "DaoLogic";
    string private constant SafeLogic = "SafeLogic";
    string private constant SafeFactory = "SafeFactory";
    string private constant HederaService = "HederaService";
    string private constant MultiSend = "MultiSend";

    address private daoLogic;
    address private safeLogic;
    address private safeFactory;
    IHederaService private hederaService;
    HederaMultiSend private multiSend;

    address[] private daos;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract with the required parameters.
     *
     * @param _iSystemRoleBasedAccess The address of the roles manager contract.
     * @param _daoLogic The DAO logic contract address.
     * @param _safeLogic The Safe logic contract address.
     * @param _safeFactory The Safe factory contract address.
     * @param _feeConfig The fee config.
     * @param _hederaService The Hedera service address.
     * @param _multiSend The address of the Hedera multisend contract.
     */
    function initialize(
        ISystemRoleBasedAccess _iSystemRoleBasedAccess,
        address _daoLogic,
        address _safeLogic,
        address _safeFactory,
        FeeConfig memory _feeConfig,
        IHederaService _hederaService,
        HederaMultiSend _multiSend
    ) external initializer {
        __FeeConfiguration_init(_feeConfig, _iSystemRoleBasedAccess);

        daoLogic = _daoLogic;
        safeLogic = _safeLogic;
        safeFactory = _safeFactory;
        hederaService = _hederaService;
        multiSend = _multiSend;
        emit LogicUpdated(address(0), daoLogic, DaoLogic);
        emit LogicUpdated(address(0), safeLogic, SafeLogic);
        emit LogicUpdated(address(0), safeFactory, SafeFactory);
        emit LogicUpdated(address(0), address(hederaService), HederaService);
        emit LogicUpdated(address(0), address(multiSend), MultiSend);
    }

    /**
     * @dev Upgrades the Safe factory contract.
     *
     * @param _newImpl The address of the new implementation.
     */
    function upgradeSafeFactoryAddress(address _newImpl) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        emit LogicUpdated(safeFactory, _newImpl, SafeFactory);
        safeFactory = _newImpl;
    }

    /**
     * @dev Upgrades the Hedera gnosis safe implementation.
     *
     * @param _newImpl The address of the new implementation.
     */
    function upgradeSafeLogicAddress(address _newImpl) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        emit LogicUpdated(safeLogic, _newImpl, SafeLogic);
        safeLogic = _newImpl;
    }

    /**
     * @dev Upgrades DAO logic contract.
     *
     * @param _newImpl The addres of the new DAO logic contract.
     */
    function upgradeDaoLogicAddress(address _newImpl) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        emit LogicUpdated(daoLogic, _newImpl, DaoLogic);
        daoLogic = _newImpl;
    }

    /**
     * @dev Upgrades the Hedera service implementation.
     *
     * @param newHederaService The address of the new implementation.
     */
    function upgradeHederaService(IHederaService newHederaService) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        emit LogicUpdated(
            address(hederaService),
            address(newHederaService),
            HederaService
        );
        hederaService = newHederaService;
    }

    /**
     * @dev Upgrades the multi send contract.
     *
     * @param _multiSend The address of the new implementation.
     */
    function upgradeMultiSend(HederaMultiSend _multiSend) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        emit LogicUpdated(address(multiSend), address(_multiSend), MultiSend);
        multiSend = _multiSend;
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
     * @dev Returns the Hedera multisend contract address.
     */
    function getMultiSendContractAddress() external view returns (address) {
        return address(multiSend);
    }

    /**
     * @dev Deploys a new DAO.
     *
     * @param _createDAOInputs The struct with deployment parameters.
     * @return The deployed DAO address.
     */
    function createDAO(
        MultiSigCreateDAOInputs memory _createDAOInputs
    ) external payable returns (address) {
        _deductFee(hederaService);
        HederaGnosisSafe hederaGnosisSafe = _createGnosisSafeProxyInstance(
            _createDAOInputs.owners,
            _createDAOInputs.threshold
        );
        address createdDAOAddress = _createMultiSigDAOInstance(
            _createDAOInputs.admin,
            _createDAOInputs.name,
            _createDAOInputs.logoUrl,
            _createDAOInputs.infoUrl,
            _createDAOInputs.description,
            _createDAOInputs.webLinks,
            hederaGnosisSafe
        );
        if (!_createDAOInputs.isPrivate) {
            daos.push(createdDAOAddress);
        }
        emit DAOCreated(
            createdDAOAddress,
            address(hederaGnosisSafe),
            address(multiSend),
            _createDAOInputs
        );
        return createdDAOAddress;
    }

    /**
     * @dev Deploys a new DAO.
     *
     * @param _admin The admin address.
     * @param _name The DAO name.
     * @param _logoUrl The DAO logo URL.
     * @param _infoUrl The DAO info URL.
     * @param _desc The DAO description.
     * @param _webLinks The DAO web links.
     * @param hederaGnosisSafe The Hedera gnosis safe contract address.
     * @return The deployed DAO address.
     */
    function _createMultiSigDAOInstance(
        address _admin,
        string memory _name,
        string memory _logoUrl,
        string memory _infoUrl,
        string memory _desc,
        string[] memory _webLinks,
        HederaGnosisSafe hederaGnosisSafe
    ) private returns (address) {
        address proxyAdmin = iSystemRoleBasedAccess.getSystemUsers().proxyAdmin;
        TransparentUpgradeableProxy upgradeableProxy = new TransparentUpgradeableProxy(
                daoLogic,
                proxyAdmin,
                NO_DATA
            );
        MultiSigDAO _mSigDAO = MultiSigDAO(address(upgradeableProxy));
        _mSigDAO.initialize(
            _admin,
            _name,
            _logoUrl,
            _infoUrl,
            _desc,
            _webLinks,
            hederaGnosisSafe,
            hederaService,
            multiSend,
            iSystemRoleBasedAccess
        );
        return address(_mSigDAO);
    }

    /**
     * @dev Deploys a gnosis safe proxy.
     *
     * @param _owners The safe owners.
     * @param _threshold The safe threshold.
     * @return The deployed Hedera gnosis safe.
     */
    function _createGnosisSafeProxyInstance(
        address[] memory _owners,
        uint256 _threshold
    ) private returns (HederaGnosisSafe) {
        address _zero;
        bytes memory _data;
        address payable gnosisSafeProxyAddress = payable(
            HederaGnosisSafeProxyFactory(safeFactory).createProxy(
                safeLogic,
                NO_DATA
            )
        );
        HederaGnosisSafe gnosisSafe = HederaGnosisSafe(gnosisSafeProxyAddress);
        gnosisSafe.setup(
            _owners,
            _threshold,
            _zero,
            _data,
            _zero,
            _zero,
            0,
            payable(_zero)
        );
        return gnosisSafe;
    }
}
