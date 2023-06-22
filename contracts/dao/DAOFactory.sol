//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../common/IERC20.sol";
import "../common/IEvents.sol";
import "../common/IErrors.sol";
import "../common/IHederaService.sol";
import "../common/RoleBasedAccess.sol";

import "../dao/TokenTransferDAO.sol";
import "../governance/ITokenHolderFactory.sol";
import "../governance/IGovernorTransferToken.sol";
import "./ISharedDAOModel.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract DAOFactory is
    IErrors,
    IEvents,
    OwnableUpgradeable,
    ISharedDAOModel,
    RoleBasedAccess
{
    event DAOCreated(
        address daoAddress,
        Governor governors,
        address tokenHolderAddress,
        CreateDAOInputs inputs
    );

    error NotAdmin(string message);

    string private constant TokenDAO = "TokenDAO";
    string private constant TransferToken = "TransferToken";
    string private constant TokenHolderFactory = "TokenHolderFactory";
    string private constant Governors = "Governors";

    IHederaService private hederaService;
    address private proxyAdmin;

    address[] private daos;

    IGovernanceDAO private daoLogic;
    ITokenHolderFactory private tokenHolderFactory;
    Governor governors;

    modifier ifAdmin() {
        if (msg.sender != proxyAdmin) {
            revert NotAdmin("DAOFactory: auth failed");
        }
        _;
    }

    function initialize(
        address _proxyAdmin,
        IHederaService _hederaService,
        IGovernanceDAO _daoLogic,
        ITokenHolderFactory _tokenHolderFactory,
        Governor memory _governors
    ) external initializer {
        systemUser = msg.sender;
        __Ownable_init();
        proxyAdmin = _proxyAdmin;
        hederaService = _hederaService;
        daoLogic = _daoLogic;
        tokenHolderFactory = _tokenHolderFactory;
        governors = _governors;

        emit LogicUpdated(address(0), address(daoLogic), TokenDAO);
        emit LogicUpdated(
            address(0),
            address(tokenHolderFactory),
            TokenHolderFactory
        );

        Governor memory oldGovernors;
        emit GovernorLogicUpdated(oldGovernors, _governors, Governors);
    }

    function getTokenHolderFactoryAddress()
        external
        view
        ifAdmin
        returns (address)
    {
        return address(tokenHolderFactory);
    }

    function upgradeTokenHolderFactory(
        ITokenHolderFactory _newTokenHolderFactory
    ) external ifAdmin {
        emit LogicUpdated(
            address(tokenHolderFactory),
            address(_newTokenHolderFactory),
            TokenHolderFactory
        );
        tokenHolderFactory = _newTokenHolderFactory;
    }

    function upgradeTokenDaoLogicImplementation(
        IGovernanceDAO _newImpl
    ) external ifAdmin {
        emit LogicUpdated(address(daoLogic), address(_newImpl), TokenDAO);
        daoLogic = _newImpl;
    }

    function upgradeGovernorsImplementation(
        Governor memory _newImpl
    ) external ifAdmin {
        emit GovernorLogicUpdated(governors, _newImpl, Governors);
        governors = _newImpl;
    }

    function createDAO(
        CreateDAOInputs memory _createDAOInputs
    ) external returns (address) {
        if (address(_createDAOInputs.tokenAddress) == address(0)) {
            revert InvalidInput("DAOFactory: token address is zero");
        }
        if (_createDAOInputs.votingPeriod == 0) {
            revert InvalidInput("DAOFactory: voting period is zero");
        }
        ITokenHolder iTokenHolder = tokenHolderFactory.getTokenHolder(
            address(_createDAOInputs.tokenAddress)
        );
        address createdDAOAddress = _createTokenDAOContractInstance(
            _createDAOInputs,
            iTokenHolder
        );
        if (!_createDAOInputs.isPrivate) {
            daos.push(createdDAOAddress);
        }
        emit DAOCreated(
            createdDAOAddress,
            governors,
            address(iTokenHolder),
            _createDAOInputs
        );
        return createdDAOAddress;
    }

    function getDAOs() external view returns (address[] memory) {
        return daos;
    }

    function upgradeHederaService(
        IHederaService newHederaService
    ) external onlyOwner {
        hederaService = newHederaService;
    }

    function getHederaServiceVersion() external view returns (IHederaService) {
        return hederaService;
    }

    function _createTokenDAOContractInstance(
        CreateDAOInputs memory _createDAOInputs,
        ITokenHolder iTokenHolder
    ) private returns (address daoAddress) {
        TokenTransferDAO tokenDAO = TokenTransferDAO(
            _createProxy(address(daoLogic))
        );
        Common memory common;
        common.hederaService = hederaService;
        common.iTokenHolder = iTokenHolder;
        common.proxyAdmin = proxyAdmin;
        common.systemUser = systemUser;
        tokenDAO.initialize(_createDAOInputs, governors, common);
        return address(tokenDAO);
    }

    function _createProxy(address _logic) private returns (address) {
        bytes memory _data;
        return
            address(new TransparentUpgradeableProxy(_logic, proxyAdmin, _data));
    }
}
