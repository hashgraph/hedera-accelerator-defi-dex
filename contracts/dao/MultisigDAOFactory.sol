//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./ISharedDAOModel.sol";

import "../common/IEvents.sol";
import "../common/IErrors.sol";
import "../common/IHederaService.sol";
import "../common/RoleBasedAccess.sol";

import "../dao/MultisigDAO.sol";

import "../gnosis/HederaMultiSend.sol";
import "../gnosis/HederaGnosisSafe.sol";
import "../gnosis/HederaGnosisSafeProxyFactory.sol";

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract MultisigDAOFactory is
    IErrors,
    IEvents,
    ISharedDAOModel,
    RoleBasedAccess
{
    event DAOCreated(
        address daoAddress,
        address safeAddress,
        address multiSendAddress,
        MultiSigCreateDAOInputs inputs
    );

    error NotAdmin(string message);

    bytes private constant NO_DATA = "";
    string private constant DaoLogic = "DaoLogic";
    string private constant SafeLogic = "SafeLogic";
    string private constant SafeFactory = "SafeFactory";

    address private daoLogic;
    address private safeLogic;
    address private safeFactory;
    IHederaService private hederaService;
    HederaMultiSend private multiSend;

    address[] private daos;

    function initialize(
        SystemUsers memory _systemUsers,
        address _daoLogic,
        address _safeLogic,
        address _safeFactory,
        IHederaService _hederaService,
        HederaMultiSend _multiSend
    ) external initializer {
        _grantRole(DEFAULT_ADMIN_ROLE, _systemUsers.superAdmin);
        _grantRole(PROXY_ADMIN_ROLE, _systemUsers.proxyAdmin);
        _grantRole(CHILD_PROXY_ADMIN_ROLE, _systemUsers.childProxyAdmin);

        systemUsers = _systemUsers;
        daoLogic = _daoLogic;
        safeLogic = _safeLogic;
        safeFactory = _safeFactory;
        hederaService = _hederaService;
        multiSend = _multiSend;
        emit LogicUpdated(address(0), daoLogic, DaoLogic);
        emit LogicUpdated(address(0), safeLogic, SafeLogic);
        emit LogicUpdated(address(0), safeFactory, SafeFactory);
    }

    function upgradeSafeFactoryAddress(
        address _newImpl
    ) external onlyRole(CHILD_PROXY_ADMIN_ROLE) {
        emit LogicUpdated(safeFactory, _newImpl, SafeFactory);
        safeFactory = _newImpl;
    }

    function upgradeSafeLogicAddress(
        address _newImpl
    ) external onlyRole(CHILD_PROXY_ADMIN_ROLE) {
        emit LogicUpdated(safeLogic, _newImpl, SafeLogic);
        safeLogic = _newImpl;
    }

    function upgradeDaoLogicAddress(
        address _newImpl
    ) external onlyRole(CHILD_PROXY_ADMIN_ROLE) {
        emit LogicUpdated(daoLogic, _newImpl, DaoLogic);
        daoLogic = _newImpl;
    }

    function upgradeHederaService(
        IHederaService newHederaService
    ) external onlyRole(CHILD_PROXY_ADMIN_ROLE) {
        hederaService = newHederaService;
    }

    function upgradeMultiSend(
        HederaMultiSend _multiSend
    ) external onlyRole(CHILD_PROXY_ADMIN_ROLE) {
        multiSend = _multiSend;
    }

    function getDAOs() external view returns (address[] memory) {
        return daos;
    }

    function getHederaServiceVersion() external view returns (IHederaService) {
        return hederaService;
    }

    function getMultiSendContractAddress() external view returns (address) {
        return address(multiSend);
    }

    function createDAO(
        MultiSigCreateDAOInputs memory _createDAOInputs
    ) external returns (address) {
        HederaGnosisSafe hederaGnosisSafe = _createGnosisSafeProxyInstance(
            _createDAOInputs.owners,
            _createDAOInputs.threshold
        );
        address createdDAOAddress = _createMultiSigDAOInstance(
            _createDAOInputs.admin,
            _createDAOInputs.name,
            _createDAOInputs.logoUrl,
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

    function _createMultiSigDAOInstance(
        address _admin,
        string memory _name,
        string memory _logoUrl,
        string memory _desc,
        string[] memory _webLinks,
        HederaGnosisSafe hederaGnosisSafe
    ) private returns (address) {
        TransparentUpgradeableProxy upgradeableProxy = new TransparentUpgradeableProxy(
                daoLogic,
                systemUsers.proxyAdmin,
                NO_DATA
            );
        MultiSigDAO _mSigDAO = MultiSigDAO(address(upgradeableProxy));
        _mSigDAO.initialize(
            _admin,
            _name,
            _logoUrl,
            _desc,
            _webLinks,
            hederaGnosisSafe,
            hederaService,
            multiSend,
            systemUsers
        );
        return address(_mSigDAO);
    }

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
