//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;
import "./BaseDAO.sol";
import "./ISharedDAOModel.sol";
import "../common/ISystemRoleBasedAccess.sol";

import "../governance/GovernorUpgrade.sol";
import "../governance/GovernorTokenCreate.sol";
import "../governance/GovernorTextProposal.sol";
import "../governance/GovernorTransferToken.sol";

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract FTDAO is BaseDAO, ISharedDAOModel {
    address private governorTokenTransferProxy;
    address private governorUpgradeProxy;
    address private governorTextProposalProxy;
    address private governorTokenCreateProxy;
    ISystemRoleBasedAccess private iSystemRoleBasedAccess;

    function initialize(
        CreateDAOInputs memory inputs,
        Governor memory governor,
        Common memory common,
        ISystemRoleBasedAccess _iSystemRoleBasedAccess
    ) external initializer {
        iSystemRoleBasedAccess = _iSystemRoleBasedAccess;

        governorTokenTransferProxy = _createGovernorContractInstance(
            inputs,
            common,
            governor.tokenTransferLogic
        );
        governorTextProposalProxy = _createGovernorContractInstance(
            inputs,
            common,
            governor.textLogic
        );
        governorUpgradeProxy = _createGovernorContractInstance(
            inputs,
            common,
            governor.contractUpgradeLogic
        );
        governorTokenCreateProxy = _createGovernorContractInstance(
            inputs,
            common,
            governor.createTokenLogic
        );

        __BaseDAO_init(
            inputs.admin,
            inputs.name,
            inputs.logoUrl,
            inputs.infoUrl,
            inputs.description,
            inputs.webLinks
        );
    }

    function getGovernorContractAddresses()
        external
        view
        returns (address, address, address, address)
    {
        return (
            governorTokenTransferProxy,
            governorTextProposalProxy,
            governorUpgradeProxy,
            governorTokenCreateProxy
        );
    }

    function upgradeHederaService(IHederaService newHederaService) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        IGovernorBase(governorTokenTransferProxy).upgradeHederaService(
            newHederaService
        );
        IGovernorBase(governorTextProposalProxy).upgradeHederaService(
            newHederaService
        );
        IGovernorBase(governorUpgradeProxy).upgradeHederaService(
            newHederaService
        );
        IGovernorBase(governorTokenCreateProxy).upgradeHederaService(
            newHederaService
        );
    }

    function _createGovernorContractInstance(
        CreateDAOInputs memory inputs,
        Common memory common,
        address governor
    ) private returns (address) {
        address proxyAdmin = iSystemRoleBasedAccess.getSystemUsers().proxyAdmin;
        IGovernorBase iGovernorBase = IGovernorBase(
            _createProxy(governor, proxyAdmin)
        );

        iGovernorBase.initialize(
            inputs.tokenAddress,
            inputs.votingDelay,
            inputs.votingPeriod,
            common.hederaService,
            common.iTokenHolder,
            inputs.quorumThreshold,
            iSystemRoleBasedAccess
        );
        return address(iGovernorBase);
    }

    function _createProxy(
        address _logic,
        address proxyAdmin
    ) private returns (address) {
        bytes memory _data;
        return
            address(new TransparentUpgradeableProxy(_logic, proxyAdmin, _data));
    }
}
