//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../common/IBaseHTS.sol";
import "../common/IERC20.sol";

import "../dao/IGovernanceDAO.sol";
import "../governance/IGODTokenHolderFactory.sol";
import "../governance/IGovernorTransferToken.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract GovernanceDAOFactory is OwnableUpgradeable {
    event PublicDaoCreated(
        address indexed daoAddress,
        string name,
        address admin
    );

    event PrivateDaoCreated(
        address indexed daoAddress,
        string name,
        address admin
    );

    address private baseHTS;
    address private proxyAdmin;

    address[] private daos;

    address private doaLogic;
    IGODTokenHolderFactory private godTokenHolderFactory;
    address private tokenTransferLogic;

    function initialize(
        address _proxyAdmin,
        address _baseHTS,
        address _daoLogic,
        IGODTokenHolderFactory _godTokenHolderFactory,
        address _tokenTransferLogic
    ) external initializer {
        __Ownable_init();
        proxyAdmin = _proxyAdmin;
        baseHTS = _baseHTS;
        doaLogic = _daoLogic;
        godTokenHolderFactory = _godTokenHolderFactory;
        tokenTransferLogic = _tokenTransferLogic;
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
        IGODHolder iGODHolder = godTokenHolderFactory.getGODTokenHolder(
            _tokenAddress
        );
        IGovernorTransferToken tokenTransfer = _createTokenTransfer(
            address(_tokenAddress),
            _quorumThreshold,
            _votingDelay,
            _votingPeriod,
            iGODHolder
        );
        address createdDAOAddress = _createDAO(
            _admin,
            _name,
            address(tokenTransfer)
        );

        if (_isPrivate) {
            emit PrivateDaoCreated(createdDAOAddress, _name, _admin);
        } else {
            daos.push(createdDAOAddress);
            emit PublicDaoCreated(createdDAOAddress, _name, _admin);
        }
        return createdDAOAddress;
    }

    function _createTokenTransfer(
        address _tokenAddress,
        uint256 _quorumThreshold,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        IGODHolder _iGODHolder
    ) private returns (IGovernorBase iGovernorBase) {
        iGovernorBase = IGovernorBase(_createProxy(tokenTransferLogic));
        iGovernorBase.initialize(
            IERC20(_tokenAddress),
            _votingDelay,
            _votingPeriod,
            IBaseHTS(baseHTS),
            _iGODHolder,
            _quorumThreshold
        );
    }

    function _createDAO(
        address _admin,
        string calldata _name,
        address _governorTokenTransferContractAddress
    ) private returns (address daoAddress) {
        IGovernanceDAO iGovernanceDAO = IGovernanceDAO(_createProxy(doaLogic));
        iGovernanceDAO.initialize(
            _admin,
            _name,
            _governorTokenTransferContractAddress
        );
        return address(iGovernanceDAO);
    }

    function _createProxy(address _logic) private returns (address) {
        bytes memory _data;
        return
            address(new TransparentUpgradeableProxy(_logic, proxyAdmin, _data));
    }
}
