//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../common/ISharedModel.sol";
import "../common/IHederaService.sol";
import "../common/TokenOperations.sol";

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

abstract contract FeeConfiguration is
    ISharedModel,
    Initializable,
    TokenOperations
{
    event FeeConfigUpdated(FeeConfig feeConfig);

    FeeConfig public feeConfig;

    uint256[49] private __gap__;

    function __FeeConfiguration_init(
        FeeConfig memory _feeConfig
    ) internal onlyInitializing {
        _updateFeeConfigInternally(
            _feeConfig.receiver,
            _feeConfig.tokenAddress,
            _feeConfig.amountOrId
        );
    }

    function _feeConfigExecutor() internal view virtual returns (address) {
        return feeConfig.receiver;
    }

    function updateFeeConfig(FeeConfig memory _feeConfig) external {
        require(msg.sender == _feeConfigExecutor(), "FC: No Authorization");
        _updateFeeConfigInternally(
            _feeConfig.receiver,
            _feeConfig.tokenAddress,
            _feeConfig.amountOrId
        );
    }

    function _deductFee(IHederaService _hederaService) internal {
        if (feeConfig.tokenAddress == address(0)) {
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
