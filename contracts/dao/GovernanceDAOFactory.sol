//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../common/IERC20.sol";
import "../common/IEvents.sol";
import "../common/IBaseHTS.sol";

import "../dao/IGovernorTokenDAO.sol";
import "../governance/IGODTokenHolderFactory.sol";
import "../governance/IGovernorTransferToken.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract GovernanceDAOFactory is OwnableUpgradeable, IEvents {
    event PublicDaoCreated(address daoAddress);
    event PrivateDaoCreated(address daoAddress);

    error NotAdmin(string message);
    error InvalidInput(string message);

    string private constant GovernorTokenDAO = "GovernorTokenDAO";
    string private constant GovernorTransferToken = "GovernorTransferToken";
    string private constant GODTokenHolderFactory = "GODTokenHolderFactory";

    IBaseHTS private baseHTS;
    address private proxyAdmin;

    address[] private daos;

    IGovernorTokenDAO private doaLogic;
    IGovernorTransferToken private tokenTransferLogic;
    IGODTokenHolderFactory private godTokenHolderFactory;

    modifier ifAdmin() {
        if (msg.sender != proxyAdmin) {
            revert NotAdmin("GovernanceDAOFactory: auth failed");
        }
        _;
    }

    function initialize(
        address _proxyAdmin,
        IBaseHTS _baseHTS,
        IGovernorTokenDAO _daoLogic,
        IGODTokenHolderFactory _godTokenHolderFactory,
        IGovernorTransferToken _tokenTransferLogic
    ) external initializer {
        __Ownable_init();
        proxyAdmin = _proxyAdmin;
        baseHTS = _baseHTS;
        doaLogic = _daoLogic;
        godTokenHolderFactory = _godTokenHolderFactory;
        tokenTransferLogic = _tokenTransferLogic;

        emit LogicUpdated(address(0), address(doaLogic), GovernorTokenDAO);
        emit LogicUpdated(
            address(0),
            address(tokenTransferLogic),
            GovernorTransferToken
        );
        emit LogicUpdated(
            address(0),
            address(godTokenHolderFactory),
            GODTokenHolderFactory
        );
    }

    function upgradeGODTokenHolderFactory(
        IGODTokenHolderFactory _newGodTokenHolderFactory
    ) external ifAdmin {
        emit LogicUpdated(
            address(godTokenHolderFactory),
            address(_newGodTokenHolderFactory),
            GODTokenHolderFactory
        );
        godTokenHolderFactory = _newGodTokenHolderFactory;
    }

    function upgradeGovernorTokenDaoLogicImplementation(
        IGovernorTokenDAO _newImpl
    ) external ifAdmin {
        emit LogicUpdated(
            address(doaLogic),
            address(_newImpl),
            GovernorTokenDAO
        );
        doaLogic = _newImpl;
    }

    function upgradeGovernorTokenTransferLogicImplementation(
        IGovernorTransferToken _newImpl
    ) external ifAdmin {
        emit LogicUpdated(
            address(tokenTransferLogic),
            address(_newImpl),
            GovernorTransferToken
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
            revert InvalidInput("GovernanceDAOFactory: name is empty");
        }
        if (bytes(_logoUrl).length == 0) {
            revert InvalidInput("GovernanceDAOFactory: url is empty");
        }
        if (address(_tokenAddress) == address(0)) {
            revert InvalidInput("GovernanceDAOFactory: token address is zero");
        }
        if (address(_admin) == address(0)) {
            revert InvalidInput("GovernanceDAOFactory: admin address is zero");
        }
        if (_votingPeriod == 0) {
            revert InvalidInput("GovernanceDAOFactory: voting period is zero");
        }
        IGODHolder iGODHolder = godTokenHolderFactory.getGODTokenHolder(
            _tokenAddress
        );
        IGovernorTransferToken tokenTransfer = _createGovernorTransferTokenContractInstance(
                address(_tokenAddress),
                _quorumThreshold,
                _votingDelay,
                _votingPeriod,
                iGODHolder
            );
        address createdDAOAddress = _createGovernorTokenDAOContractInstance(
            _admin,
            _name,
            _logoUrl,
            tokenTransfer
        );
        if (_isPrivate) {
            emit PrivateDaoCreated(createdDAOAddress);
        } else {
            daos.push(createdDAOAddress);
            emit PublicDaoCreated(createdDAOAddress);
        }
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
        IGODHolder _iGODHolder
    ) private returns (IGovernorTransferToken iGovernorTransferToken) {
        iGovernorTransferToken = IGovernorTransferToken(
            _createProxy(address(tokenTransferLogic))
        );
        iGovernorTransferToken.initialize(
            IERC20(_tokenAddress),
            _votingDelay,
            _votingPeriod,
            baseHTS,
            _iGODHolder,
            _quorumThreshold
        );
    }

    function _createGovernorTokenDAOContractInstance(
        address _admin,
        string calldata _name,
        string calldata _logoUrl,
        IGovernorTransferToken _governorTokenTransferContractAddress
    ) private returns (address daoAddress) {
        IGovernorTokenDAO governanceDAO = IGovernorTokenDAO(
            _createProxy(address(doaLogic))
        );
        governanceDAO.initialize(
            _admin,
            _name,
            _logoUrl,
            _governorTokenTransferContractAddress
        );
        return address(governanceDAO);
    }

    function _createProxy(address _logic) private returns (address) {
        bytes memory _data;
        return
            address(new TransparentUpgradeableProxy(_logic, proxyAdmin, _data));
    }
}
