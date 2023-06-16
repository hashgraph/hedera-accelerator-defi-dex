//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../common/IEvents.sol";
import "../common/IErrors.sol";
import "../common/CommonOperations.sol";
import "../common/IHederaService.sol";

import "../dao/MultisigDAO.sol";

import "../gnosis/HederaGnosisSafe.sol";
import "../gnosis/HederaGnosisSafeProxyFactory.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract MultisigDAOFactory is IErrors, IEvents, OwnableUpgradeable {
    event DAOCreated(
        address daoAddress,
        address safeAddress,
        CreateDAOInputs inputs
    );

    struct CreateDAOInputs {
        address admin;
        string name;
        string logoUrl;
        address[] owners;
        uint256 threshold;
        bool isPrivate;
        string description;
        string[] webLinks;
    }

    error NotAdmin(string message);

    bytes private constant NO_DATA = "";
    string private constant DaoLogic = "DaoLogic";
    string private constant SafeLogic = "SafeLogic";
    string private constant SafeFactory = "SafeFactory";

    address private proxyAdmin;

    address private daoLogic;
    address private safeLogic;
    address private safeFactory;
    IHederaService private hederaService;

    address[] private daos;

    modifier ifAdmin() {
        if (msg.sender != proxyAdmin) {
            revert NotAdmin("MultisigDAOFactory: auth failed");
        }
        _;
    }

    function initialize(
        address _proxyAdmin,
        address _daoLogic,
        address _safeLogic,
        address _safeFactory,
        IHederaService _hederaService
    ) external initializer {
        __Ownable_init();
        proxyAdmin = _proxyAdmin;
        daoLogic = _daoLogic;
        safeLogic = _safeLogic;
        safeFactory = _safeFactory;
        hederaService = _hederaService;
        emit LogicUpdated(address(0), daoLogic, DaoLogic);
        emit LogicUpdated(address(0), safeLogic, SafeLogic);
        emit LogicUpdated(address(0), safeFactory, SafeFactory);
    }

    function upgradeSafeFactoryAddress(address _newImpl) external ifAdmin {
        emit LogicUpdated(safeFactory, _newImpl, SafeFactory);
        safeFactory = _newImpl;
    }

    function upgradeSafeLogicAddress(address _newImpl) external ifAdmin {
        emit LogicUpdated(safeLogic, _newImpl, SafeLogic);
        safeLogic = _newImpl;
    }

    function upgradeDaoLogicAddress(address _newImpl) external ifAdmin {
        emit LogicUpdated(daoLogic, _newImpl, DaoLogic);
        daoLogic = _newImpl;
    }

    function getDAOs() external view returns (address[] memory) {
        return daos;
    }

    function createDAO(
        CreateDAOInputs memory _createDAOInputs
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
            _createDAOInputs
        );
        return createdDAOAddress;
    }

    function upgradeHederaService(
        IHederaService newHederaService
    ) external onlyOwner {
        hederaService = newHederaService;
        for (uint i = 0; i < daos.length; i++) {
            MultiSigDAO dao = MultiSigDAO(daos[i]);
            dao.upgradeHederaService(newHederaService);
        }
    }

    function getHederaServiceVersion() external view returns (IHederaService) {
        return hederaService;
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
                proxyAdmin,
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
            hederaService
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
