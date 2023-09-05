// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;
import "./GovernorCountingSimpleInternal.sol";

contract GovernorUpgrade is GovernorCountingSimpleInternal {
    function createProposal(
        string memory _title,
        string memory _description,
        string memory _linkToDiscussion,
        address _proxy,
        address _proxyLogic,
        uint256 _nftTokenSerialId
    ) public returns (uint256) {
        address proxyAdmin = iSystemRoleBasedAccess.getSystemUsers().proxyAdmin;
        return
            _createProposal(
                _title,
                _description,
                _linkToDiscussion,
                abi.encode(_proxy, _proxyLogic, proxyAdmin),
                _nftTokenSerialId
            );
    }

    function getContractAddresses(
        uint256 proposalId
    ) public view returns (address proxy, address proxyLogic) {
        (proxy, proxyLogic, ) = _decode(proposalId);
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
        (address proxy, address proxyLogic, address proxyAdmin) = _decode(
            proposalId
        );
        _upgradeProxy(proxy, proxyLogic, proxyAdmin);
        super._execute(proposalId, targets, values, calldatas, description);
    }

    function _decode(
        uint256 proposalId
    )
        private
        view
        returns (address proxy, address proxyLogic, address proxyAdmin)
    {
        (proxy, proxyLogic, proxyAdmin) = abi.decode(
            proposals[proposalId].data,
            (address, address, address)
        );
    }

    function _upgradeProxy(
        address _proxy,
        address _proxyLogic,
        address _proxyAdmin
    ) private {
        (bool success, ) = _proxy.call(
            abi.encodeWithSignature("upgradeTo(address)", _proxyLogic)
        );
        require(
            success,
            "GU: failed to upgrade proxy, verify governor is owner"
        );
        (success, ) = _proxy.call(
            abi.encodeWithSignature("changeAdmin(address)", _proxyAdmin)
        );
        require(success, "GU: failed to change admin");
    }
}
