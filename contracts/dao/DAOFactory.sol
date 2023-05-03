//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import "../common/IERC20.sol";
import "../common/IEvents.sol";
import "../common/IErrors.sol";
import "../common/IBaseHTS.sol";

import "../dao/ITokenDAO.sol";
import "../governance/ITokenHolderFactory.sol";
import "../governance/IGovernorTransferToken.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract DAOFactory is OwnableUpgradeable, IEvents, IErrors {
    event DAOCreated(
        address daoAddress,
        address admin,
        string name,
        string logoUrl,
        address tokenAddress,
        uint256 quorumThreshold,
        uint256 votingDelay,
        uint256 votingPeriod,
        bool isPrivate
    );

    error NotAdmin(string message);

    string private constant TokenDAO = "TokenDAO";
    string private constant TransferToken = "TransferToken";
    string private constant TokenHolderFactory = "TokenHolderFactory";

    IBaseHTS private baseHTS;
    address private proxyAdmin;

    address[] private daos;

    ITokenDAO private daoLogic;
    IGovernorTransferToken private tokenTransferLogic;
    ITokenHolderFactory private tokenHolderFactory;

    modifier ifAdmin() {
        if (msg.sender != proxyAdmin) {
            revert NotAdmin("DAOFactory: auth failed");
        }
        _;
    }

    function initialize(
        address _proxyAdmin,
        IBaseHTS _baseHTS,
        ITokenDAO _daoLogic,
        ITokenHolderFactory _tokenHolderFactory,
        IGovernorTransferToken _tokenTransferLogic
    ) external initializer {
        __Ownable_init();
        proxyAdmin = _proxyAdmin;
        baseHTS = _baseHTS;
        daoLogic = _daoLogic;
        tokenHolderFactory = _tokenHolderFactory;
        tokenTransferLogic = _tokenTransferLogic;

        emit LogicUpdated(address(0), address(daoLogic), TokenDAO);
        emit LogicUpdated(
            address(0),
            address(tokenTransferLogic),
            TransferToken
        );
        emit LogicUpdated(
            address(0),
            address(tokenHolderFactory),
            TokenHolderFactory
        );
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
        ITokenDAO _newImpl
    ) external ifAdmin {
        emit LogicUpdated(address(daoLogic), address(_newImpl), TokenDAO);
        daoLogic = _newImpl;
    }

    function upgradeTokenTransferLogicImplementation(
        IGovernorTransferToken _newImpl
    ) external ifAdmin {
        emit LogicUpdated(
            address(tokenTransferLogic),
            address(_newImpl),
            TransferToken
        );
        tokenTransferLogic = _newImpl;
    }

    function createDAO(
        address _admin,
        string calldata _name,
        string calldata _logoUrl,
        IERC20 _tokenAddress,
        uint256 _quorumThreshold,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        bool _isPrivate
    ) external returns (address) {
        if (bytes(_name).length == 0) {
            revert InvalidInput("DAOFactory: name is empty");
        }
        if (address(_tokenAddress) == address(0)) {
            revert InvalidInput("DAOFactory: token address is zero");
        }
        if (address(_admin) == address(0)) {
            revert InvalidInput("DAOFactory: admin address is zero");
        }
        if (_votingPeriod == 0) {
            revert InvalidInput("DAOFactory: voting period is zero");
        }
        ITokenHolder iTokenHolder = tokenHolderFactory.getTokenHolder(
            address(_tokenAddress)
        );
        IGovernorTransferToken tokenTransfer = _createGovernorTransferTokenContractInstance(
                address(_tokenAddress),
                _quorumThreshold,
                _votingDelay,
                _votingPeriod,
                iTokenHolder
            );
        address createdDAOAddress = _createTokenDAOContractInstance(
            _admin,
            _name,
            _logoUrl,
            tokenTransfer
        );
        if (!_isPrivate) {
            daos.push(createdDAOAddress);
        }
        emit DAOCreated(
            createdDAOAddress,
            _admin,
            _name,
            _logoUrl,
            address(_tokenAddress),
            _quorumThreshold,
            _votingDelay,
            _votingPeriod,
            _isPrivate
        );
        return createdDAOAddress;
    }

    function getDAOs() external view returns (address[] memory) {
        return daos;
    }

    function _createGovernorTransferTokenContractInstance(
        address _tokenAddress,
        uint256 _quorumThreshold,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        ITokenHolder _iTokenHolder
    ) private returns (IGovernorTransferToken iGovernorTransferToken) {
        iGovernorTransferToken = IGovernorTransferToken(
            _createProxy(address(tokenTransferLogic))
        );
        iGovernorTransferToken.initialize(
            IERC20(_tokenAddress),
            _votingDelay,
            _votingPeriod,
            baseHTS,
            _iTokenHolder,
            _quorumThreshold
        );
    }

    function _createTokenDAOContractInstance(
        address _admin,
        string calldata _name,
        string calldata _logoUrl,
        IGovernorTransferToken _governorTokenTransferContractAddress
    ) private returns (address daoAddress) {
        ITokenDAO tokenDAO = ITokenDAO(_createProxy(address(daoLogic)));
        tokenDAO.initialize(
            _admin,
            _name,
            _logoUrl,
            _governorTokenTransferContractAddress
        );
        return address(tokenDAO);
    }

    function _createProxy(address _logic) private returns (address) {
        bytes memory _data;
        return
            address(new TransparentUpgradeableProxy(_logic, proxyAdmin, _data));
    }
}
