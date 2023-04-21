//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../common/IEvents.sol";
import "../common/IErrors.sol";
import "../common/IBaseHTS.sol";

import "../dao/MultisigDAO.sol";

import "../gnosis/HederaGnosisSafe.sol";
import "../gnosis/HederaGnosisSafeProxyFactory.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract MultisigDAOFactory is OwnableUpgradeable, IEvents, IErrors {
    event MultiSigDAOCreated(
        address daoAddress,
        address safeAddress,
        address admin,
        string name,
        string logoUrl,
        address[] owners,
        uint256 threshold,
        bool isPrivate
    );

    error NotAdmin(string message);

    bytes private constant NO_DATA = "";
    string private constant DaoLogic = "DaoLogic";
    string private constant SafeLogic = "SafeLogic";
    string private constant SafeFactory = "SafeFactory";

    address private proxyAdmin;

    address private daoLogic;
    address private safeLogic;
    address private safeFactory;
    IBaseHTS private baseHTS;

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
        IBaseHTS _baseHTS
    ) external initializer {
        __Ownable_init();
        proxyAdmin = _proxyAdmin;
        daoLogic = _daoLogic;
        safeLogic = _safeLogic;
        safeFactory = _safeFactory;
        baseHTS = _baseHTS;
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
        address _admin,
        string calldata _name,
        string calldata _logoUrl,
        address[] calldata _owners,
        uint256 _threshold,
        bool _isPrivate
    ) external returns (address) {
        HederaGnosisSafe hederaGnosisSafe = _createGnosisSafeProxyInstance(
            _owners,
            _threshold
        );
        address createdDAOAddress = _createMultiSigDAOInstance(
            _admin,
            _name,
            _logoUrl,
            hederaGnosisSafe
        );
        if (!_isPrivate) {
            daos.push(createdDAOAddress);
        }
        emit MultiSigDAOCreated(
            createdDAOAddress,
            address(hederaGnosisSafe),
            _admin,
            _name,
            _logoUrl,
            _owners,
            _threshold,
            _isPrivate
        );
        return createdDAOAddress;
    }

    function _createMultiSigDAOInstance(
        address _admin,
        string calldata _name,
        string calldata _logoUrl,
        HederaGnosisSafe hederaGnosisSafe
    ) private returns (address) {
        TransparentUpgradeableProxy upgradeableProxy = new TransparentUpgradeableProxy(
                daoLogic,
                proxyAdmin,
                NO_DATA
            );
        MultiSigDAO _mSigDAO = MultiSigDAO(address(upgradeableProxy));
        _mSigDAO.initialize(_admin, _name, _logoUrl, hederaGnosisSafe, baseHTS);
        return address(_mSigDAO);
    }

    function _createGnosisSafeProxyInstance(
        address[] calldata _owners,
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
