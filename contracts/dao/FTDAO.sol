//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;
import "./BaseDAO.sol";
import "../governance/GovernorTransferToken.sol";
import "../governance/GovernorUpgrade.sol";
import "../governance/GovernorTextProposal.sol";
import "../governance/GovernorTokenCreate.sol";
import "./ISharedDAOModel.sol";
import "../common/RoleBasedAccess.sol";

contract FTDAO is BaseDAO, ISharedDAOModel, RoleBasedAccess {
    address payable private governorTokenTransferProxy;
    address payable private governorUpgradeProxy;
    address payable private governorTextProposalProxy;
    address payable private governorTokenCreateProxy;

    uint256[] private textProposals;
    uint256[] private tokenCreateProposals;
    uint256[] private contractUpgraeProposals;
    uint256[] private tokenTransferProposals;

    function initialize(
        CreateDAOInputs memory inputs,
        Governor memory governor,
        Common memory common
    ) external initializer {
        systemUser = common.systemUser;
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

    function getTextProposals() external view returns (uint256[] memory) {
        return textProposals;
    }

    function getContractUpgradeProposals()
        external
        view
        returns (uint256[] memory)
    {
        return contractUpgraeProposals;
    }

    function getTokenTransferProposals()
        external
        view
        returns (uint256[] memory)
    {
        return tokenTransferProposals;
    }

    function getTokenCreateProposals()
        external
        view
        returns (uint256[] memory)
    {
        return tokenCreateProposals;
    }

    function createTokenTransferProposal(
        string memory _title,
        string memory _description,
        string memory _linkToDiscussion,
        address _transferFromAccount,
        address _transferToAccount,
        address _tokenToTransfer,
        uint256 _transferTokenAmount
    ) external onlyOwner returns (uint256) {
        GovernorTransferToken governorTransferToken = GovernorTransferToken(
            governorTokenTransferProxy
        );
        uint256 proposalId = governorTransferToken.createProposal(
            _title,
            _description,
            _linkToDiscussion,
            _transferFromAccount,
            _transferToAccount,
            _tokenToTransfer,
            _transferTokenAmount,
            msg.sender
        );
        tokenTransferProposals.push(proposalId);
        return proposalId;
    }

    function createContractUpgradeProposal(
        string memory _title,
        string memory _description,
        string memory _linkToDiscussion,
        address payable _proxyContract,
        address _contractToUpgrade
    ) external onlyOwner returns (uint256) {
        GovernorUpgrade governorUpgrade = GovernorUpgrade(governorUpgradeProxy);
        uint256 proposalId = governorUpgrade.createProposal(
            _title,
            _description,
            _linkToDiscussion,
            _proxyContract,
            _contractToUpgrade,
            msg.sender
        );
        contractUpgraeProposals.push(proposalId);
        return proposalId;
    }

    function createTextProposal(
        string memory _title,
        string memory _description,
        string memory _linkToDiscussion
    ) external onlyOwner returns (uint256) {
        GovernorTextProposal governorTextProposal = GovernorTextProposal(
            governorTextProposalProxy
        );
        uint256 proposalId = governorTextProposal.createProposal(
            _title,
            _description,
            _linkToDiscussion,
            msg.sender
        );
        textProposals.push(proposalId);
        return proposalId;
    }

    function createTokenCreateProposal(
        string memory title,
        string memory description,
        string memory linkToDiscussion,
        address treasurer,
        string memory tokenName,
        string memory tokenSymbol
    ) external onlyOwner returns (uint256) {
        GovernorTokenCreate governorTokenCreate = GovernorTokenCreate(
            governorTokenCreateProxy
        );
        uint256 proposalId = governorTokenCreate.createProposal(
            title,
            description,
            linkToDiscussion,
            treasurer,
            tokenName,
            tokenSymbol,
            msg.sender
        );
        tokenCreateProposals.push(proposalId);
        return proposalId;
    }

    function upgradeHederaService(
        IHederaService newHederaService
    ) external onlySystemUser {
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
    ) private returns (address payable governorBase) {
        IGovernorBase iGovernorBase = IGovernorBase(
            _createProxy(governor, common.proxyAdmin)
        );

        iGovernorBase.initialize(
            inputs.tokenAddress,
            inputs.votingDelay,
            inputs.votingPeriod,
            common.hederaService,
            common.iTokenHolder,
            inputs.quorumThreshold
        );
        return payable(address(iGovernorBase)); //All governors are payable so its safe
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
