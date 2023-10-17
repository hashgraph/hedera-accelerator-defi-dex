//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../common/IEvents.sol";
import "../common/ISharedModel.sol";
import "../common/IHederaService.sol";
import "../common/TokenOperations.sol";
import "../common/ISystemRoleBasedAccess.sol";

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

abstract contract FeeConfiguration is
    IEvents,
    ISharedModel,
    Initializable,
    TokenOperations
{
    event ExecutorChanged(
        address indexed previousExecutor,
        address indexed newExecutor
    );
    event FeeConfigUpdated(FeeConfig feeConfig);

    string private constant ISystemRole = "ISystemRole";

    address private executor;
    FeeConfig public feeConfig;
    ISystemRoleBasedAccess public iSystemRoleBasedAccess;

    uint256[49] private __gap__;

    function __FeeConfiguration_init(
        FeeConfig memory _feeConfig,
        ISystemRoleBasedAccess _iSystemRoleBasedAccess
    ) internal onlyInitializing {
        _updateFeeConfigInternally(
            _feeConfig.receiver,
            _feeConfig.tokenAddress,
            _feeConfig.amountOrId
        );
        iSystemRoleBasedAccess = _iSystemRoleBasedAccess;
        emit LogicUpdated(
            address(0),
            address(iSystemRoleBasedAccess),
            ISystemRole
        );
    }

    function _feeConfigExecutor() internal view virtual returns (address) {
        return executor;
    }

    function changeExecutorViaProposal(address _newExecutor) external {
        require(msg.sender == _feeConfigExecutor(), "FC: No Authorization");
        require(msg.sender != _newExecutor, "FC: self executor");
        emit ExecutorChanged(executor, _newExecutor);
        executor = _newExecutor;
    }

    function changeExecutor(address _newExecutor) external {
        iSystemRoleBasedAccess.checkFeeConfigChangeUser(msg.sender);
        require(msg.sender != _newExecutor, "FC: self executor");
        emit ExecutorChanged(executor, _newExecutor);
        executor = _newExecutor;
    }

    function updateFeeConfig(FeeConfig memory _feeConfig) external {
        require(msg.sender == _feeConfigExecutor(), "FC: No Authorization");
        _updateFeeConfigInternally(
            _feeConfig.receiver,
            _feeConfig.tokenAddress,
            _feeConfig.amountOrId
        );
    }

    function upgradeISystemRoleBasedAccess(
        ISystemRoleBasedAccess _iSystemRoleBasedAccess
    ) external {
        iSystemRoleBasedAccess.checkChildProxyAdminRole(msg.sender);
        emit LogicUpdated(
            address(iSystemRoleBasedAccess),
            address(_iSystemRoleBasedAccess),
            ISystemRole
        );
        iSystemRoleBasedAccess = _iSystemRoleBasedAccess;
    }

    function _deductFee(IHederaService _hederaService) internal {
        if (feeConfig.tokenAddress == address(0)) {
            require(
                msg.value == feeConfig.amountOrId,
                "FC: HBAR amount must be same to config amount"
            );
            AddressUpgradeable.sendValue(
                payable(feeConfig.receiver),
                feeConfig.amountOrId
            );
        } else {
            int256 code = _transferToken(
                _hederaService,
                feeConfig.tokenAddress,
                msg.sender,
                feeConfig.receiver,
                feeConfig.amountOrId
            );
            require(
                code == HederaResponseCodes.SUCCESS,
                "FC: Fee transfer failed"
            );
        }
    }

    function _updateFeeConfigInternally(
        address _receiver,
        address _token,
        uint256 _amountOrId
    ) private {
        require(
            _amountOrId > 0 && _receiver != address(0),
            "FC: Invalid fee config data"
        );
        feeConfig.receiver = _receiver;
        feeConfig.tokenAddress = _token;
        feeConfig.amountOrId = _amountOrId;
        emit FeeConfigUpdated(feeConfig);
    }
}
