//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../common/IERC20.sol";
import "../common/IEvents.sol";
import "../common/IErrors.sol";
import "../common/IHederaService.sol";
import "../common/CommonOperations.sol";

import "../dao/IGovernanceDAO.sol";
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

    IGovernanceDAO private daoLogic;
    IGovernorBase private governorBase;
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
        IGovernanceDAO _daoLogic,
        ITokenHolderFactory _tokenHolderFactory,
        IGovernorBase _governor
    ) external initializer {
        __Ownable_init();
        proxyAdmin = _proxyAdmin;
        hederaService = _hederaService;
        daoLogic = _daoLogic;
        tokenHolderFactory = _tokenHolderFactory;
        governorBase = _governor;

        emit LogicUpdated(address(0), address(daoLogic), TokenDAO);
        emit LogicUpdated(address(0), address(governorBase), TransferToken);
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
        IGovernanceDAO _newImpl
    ) external ifAdmin {
        emit LogicUpdated(address(daoLogic), address(_newImpl), TokenDAO);
        daoLogic = _newImpl;
    }

    function upgradeGovernorLogicImplementation(
        IGovernorTransferToken _newImpl
    ) external ifAdmin {
        emit LogicUpdated(
            address(governorBase),
            address(_newImpl),
            TransferToken
        );
        governorBase = _newImpl;
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
        IGovernorBase _governorBase = _createGovernorContractInstance(
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
            payable(address(_governorBase))
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
            IGovernanceDAO dao = IGovernanceDAO(daos[i]);
            address _governorAddress = dao.getGovernorContractAddress();
            IGovernorBase(_governorAddress).upgradeHederaService(
                newHederaService
            );
        }
    }

    function getHederaServiceVersion() external view returns (IHederaService) {
        return hederaService;
    }

    function _createGovernorContractInstance(
        address _tokenAddress,
        uint256 _quorumThreshold,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        ITokenHolder _iTokenHolder
    ) private returns (IGovernorBase iGovernorBase) {
        iGovernorBase = IGovernorBase(_createProxy(address(governorBase)));
        iGovernorBase.initialize(
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
        address payable _governorContractAddress
    ) private returns (address daoAddress) {
        IGovernanceDAO tokenDAO = IGovernanceDAO(
            _createProxy(address(daoLogic))
        );
        tokenDAO.initialize(
            _admin,
            _name,
            _logoUrl,
            _desc,
            _webLinks,
            _governorContractAddress
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
