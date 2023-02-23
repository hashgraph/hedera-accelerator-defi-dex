//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../common/IBaseHTS.sol";
import "../common/IERC20.sol";

import "../dao/IGovernorTokenDAO.sol";

import "../governance/IGODHolder.sol";
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
    address private tokenHolderLogic;
    address private tokenTransferLogic;

    function initialize(
        address _proxyAdmin,
        address _baseHTS,
        address _daoLogic,
        address _tokenHolderLogic,
        address _tokenTransferLogic
    ) external initializer {
        __Ownable_init();
        proxyAdmin = _proxyAdmin;
        baseHTS = _baseHTS;
        doaLogic = _daoLogic;
        tokenHolderLogic = _tokenHolderLogic;
        tokenTransferLogic = _tokenTransferLogic;
    }

    function createDAO(
        address _admin,
        string calldata _name,
        string calldata _logoUrl,
        address _tokenAddress,
        uint256 _quorumThreshold,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        bool _isPrivate
    ) external returns (address) {
        IGODHolder iGODHolder = _createGodHolder(_tokenAddress);
        IGovernorTransferToken tokenTransfer = _createTokenTransfer(
            _tokenAddress,
            _quorumThreshold,
            _votingDelay,
            _votingPeriod,
            iGODHolder
        );
        address createdDAOAddress = _createDAO(
            _admin,
            _name,
            _logoUrl,
            tokenTransfer
        );
        address admin = _admin;
        if (_isPrivate) {
            emit PrivateDaoCreated(createdDAOAddress, _name, admin);
        } else {
            daos.push(createdDAOAddress);
            emit PublicDaoCreated(createdDAOAddress, _name, admin);
        }
        return createdDAOAddress;
    }

    function _createGodHolder(
        address _tokenAddress
    ) private returns (IGODHolder iGODHolder) {
        iGODHolder = IGODHolder(_createProxy(tokenHolderLogic));
        iGODHolder.initialize(IBaseHTS(baseHTS), IERC20(_tokenAddress));
    }

    function _createTokenTransfer(
        address _tokenAddress,
        uint256 _quorumThreshold,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        IGODHolder _iGODHolder
    ) private returns (IGovernorTransferToken iGovernorBase) {
        iGovernorBase = IGovernorTransferToken(
            _createProxy(tokenTransferLogic)
        );
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
        string calldata _logoUrl,
        IGovernorTransferToken _governorTokenTransferContractAddress
    ) private returns (address daoAddress) {
        IGovernorTokenDAO governanceDAO = IGovernorTokenDAO(
            _createProxy(doaLogic)
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
