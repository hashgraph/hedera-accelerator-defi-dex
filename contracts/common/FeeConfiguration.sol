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
    event FeeConfigControllerChanged(
        address indexed previousController,
        address indexed newController
    );
    event FeeConfigUpdated(FeeConfig feeConfig);

    string private constant ISystemRole = "ISystemRole";

    FeeConfig public feeConfig;
    address private feeConfigController;
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

    function _feeConfigController() internal view virtual returns (address) {
        return feeConfigController;
    }

    function changeFeeConfigControllerViaProposal(
        address _newController
    ) external {
        require(msg.sender == _feeConfigController(), "FC: No Authorization");
        require(msg.sender != _newController, "FC: self not allowed");
        emit FeeConfigControllerChanged(feeConfigController, _newController);
        feeConfigController = _newController;
    }

    function changeFeeConfigController(address _newController) external {
        iSystemRoleBasedAccess.checkFeeConfigControllerUser(msg.sender);
        require(msg.sender != _newController, "FC: self not allowed");
        emit FeeConfigControllerChanged(feeConfigController, _newController);
        feeConfigController = _newController;
    }

    function updateFeeConfig(FeeConfig memory _feeConfig) external {
        require(msg.sender == _feeConfigController(), "FC: No Authorization");
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
