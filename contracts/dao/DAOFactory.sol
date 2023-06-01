//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../common/IERC20.sol";
import "../common/IEvents.sol";
import "../common/IErrors.sol";
import "../common/IHederaService.sol";
import "../common/CommonOperations.sol";

import "../dao/ITokenDAO.sol";
import "../governance/ITokenHolderFactory.sol";
import "../governance/IGovernorTransferToken.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract DAOFactory is IErrors, IEvents, CommonOperations, OwnableUpgradeable {
    event DAOCreated(
        address daoAddress,
        address admin,
        string name,
        string logoUrl,
        address tokenAddress,
        uint256 quorumThreshold,
        uint256 votingDelay,
        uint256 votingPeriod,
        bool isPrivate,
        string description,
        string webLinks
    );

    struct CreateDAOInputs {
        address admin;
        string name;
        string logoUrl;
        IERC20 tokenAddress;
        uint256 quorumThreshold;
        uint256 votingDelay;
        uint256 votingPeriod;
        bool isPrivate;
        string description;
        string[] webLinks;
    }

    error NotAdmin(string message);

    string private constant TokenDAO = "TokenDAO";
    string private constant TransferToken = "TransferToken";
    string private constant TokenHolderFactory = "TokenHolderFactory";

    IHederaService private hederaService;
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
        IHederaService _hederaService,
        ITokenDAO _daoLogic,
        ITokenHolderFactory _tokenHolderFactory,
        IGovernorTransferToken _tokenTransferLogic
    ) external initializer {
        __Ownable_init();
        proxyAdmin = _proxyAdmin;
        hederaService = _hederaService;
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
        IGovernorTransferToken tokenTransfer = _createGovernorTransferTokenContractInstance(
                address(_createDAOInputs.tokenAddress),
                _createDAOInputs.quorumThreshold,
                _createDAOInputs.votingDelay,
                _createDAOInputs.votingPeriod,
                iTokenHolder
            );
        address createdDAOAddress = _createTokenDAOContractInstance(
            _createDAOInputs.admin,
            _createDAOInputs.name,
            _createDAOInputs.logoUrl,
            _createDAOInputs.description,
            _createDAOInputs.webLinks,
            tokenTransfer
        );
        if (!_createDAOInputs.isPrivate) {
            daos.push(createdDAOAddress);
        }
        emitDOACreatedEvent(createdDAOAddress, _createDAOInputs);
        return createdDAOAddress;
    }

    function getDAOs() external view returns (address[] memory) {
        return daos;
    }

    function upgradeHederaService(
        IHederaService newHederaService
    ) external onlyOwner {
        hederaService = newHederaService;
        for (uint i = 0; i < daos.length; i++) {
            ITokenDAO dao = ITokenDAO(daos[i]);
            IGovernorTransferToken iGovernorTransferToken = IGovernorTransferToken(
                    dao.getGovernorTokenTransferContractAddress()
                );
            iGovernorTransferToken.upgradeHederaService(newHederaService);
        }
    }

    function getHederaServiceVersion() external view returns (IHederaService) {
        return hederaService;
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
            hederaService,
            _iTokenHolder,
            _quorumThreshold
        );
    }

    function _createTokenDAOContractInstance(
        address _admin,
        string memory _name,
        string memory _logoUrl,
        string memory _desc,
        string[] memory _webLinks,
        IGovernorTransferToken _governorTokenTransferContractAddress
    ) private returns (address daoAddress) {
        ITokenDAO tokenDAO = ITokenDAO(_createProxy(address(daoLogic)));
        tokenDAO.initialize(
            _admin,
            _name,
            _logoUrl,
            _desc,
            _webLinks,
            _governorTokenTransferContractAddress
        );
        return address(tokenDAO);
    }

    function _createProxy(address _logic) private returns (address) {
        bytes memory _data;
        return
            address(new TransparentUpgradeableProxy(_logic, proxyAdmin, _data));
    }

    function emitDOACreatedEvent(
        address createdDAOAddress,
        CreateDAOInputs memory _createDAOInputs
    ) private {
        emit DAOCreated(
            createdDAOAddress,
            _createDAOInputs.admin,
            _createDAOInputs.name,
            _createDAOInputs.logoUrl,
            address(_createDAOInputs.tokenAddress),
            _createDAOInputs.quorumThreshold,
            _createDAOInputs.votingDelay,
            _createDAOInputs.votingPeriod,
            _createDAOInputs.isPrivate,
            _createDAOInputs.description,
            join(_createDAOInputs.webLinks, ",")
        );
    }
}
