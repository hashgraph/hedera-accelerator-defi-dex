// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;
import "./GovernorCountingSimpleInternal.sol";

contract GovernorUpgrade is GovernorCountingSimpleInternal {
    struct UpgradeData {
        address proxy;
        address proxyLogic;
    }

    mapping(uint256 => UpgradeData) _proposalData;

    function createProposal(
        string memory _title,
        string memory _description,
        string memory _linkToDiscussion,
        address _proxy,
        address _proxyLogic,
        address _creator,
        uint256 _nftTokenSerialId
    ) public returns (uint256) {
        address proxyAdmin = iSystemRoleBasedAccess.getSystemUsers().proxyAdmin;
        uint256 proposalId = _createProposal(
            _title,
            _description,
            _linkToDiscussion,
            _creator,
            abi.encode(_proxy, _proxyLogic, proxyAdmin),
            _nftTokenSerialId
        );
        _proposalData[proposalId] = UpgradeData(_proxy, _proxyLogic);
        return proposalId;
    }

    function getContractAddresses(
        uint256 proposalId
    ) public view returns (address, address) {
        UpgradeData memory upgradeData = _proposalData[proposalId];
        return (upgradeData.proxy, upgradeData.proxyLogic);
    }

    /**
     * @dev Internal execution mechanism. Can be overridden to implement different execution mechanism
     */
    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 description
    ) internal virtual override {
        (address proxy, address proxyLogic) = getContractAddresses(proposalId);
        address proxyAdmin = iSystemRoleBasedAccess.getSystemUsers().proxyAdmin;
        _upgradeProxy(proxy, proxyLogic, proxyAdmin);
        super._execute(proposalId, targets, values, calldatas, description);
    }

    function _upgradeProxy(
        address _proxy,
        address _proxyLogic,
        address _proxyAdmin
    ) private {
        (bool success, ) = _proxy.call(
            abi.encodeWithSignature("upgradeTo(address)", _proxyLogic)
        );
        require(success, "GU: failed to upgrade proxy");
        (success, ) = _proxy.call(
            abi.encodeWithSignature("changeAdmin(address)", _proxyAdmin)
        );
        require(success, "GU: failed to change admin");
    }
}
