//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../common/ISharedModel.sol";
import "../common/IHederaService.sol";
import "../common/TokenOperations.sol";

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

abstract contract DAOConfiguration is
    ISharedModel,
    Initializable,
    TokenOperations
{
    event FeeConfigUpdated(FeeConfig feeConfig);

    FeeConfig public feeConfig;

    uint256[49] private __gap__;

    modifier onlyTreasure() {
        require(
            msg.sender == feeConfig.daoTreasurer,
            "DAOConfiguration: DAO treasurer only."
        );
        _;
    }

    function __DAOConfiguration_init(
        FeeConfig memory _feeConfig
    ) internal onlyInitializing {
        _setFeeConfigInternally(
            _feeConfig.daoTreasurer,
            _feeConfig.tokenAddress,
            _feeConfig.daoFee
        );
    }

    function changeDAOConfig(
        FeeConfig memory _feeConfig
    ) external onlyTreasure {
        _setFeeConfigInternally(
            _feeConfig.daoTreasurer,
            _feeConfig.tokenAddress,
            _feeConfig.daoFee
        );
    }

    function _deductCreationFee(IHederaService _hederaService) internal {
        if (feeConfig.tokenAddress == address(0)) {
            AddressUpgradeable.sendValue(
                payable(feeConfig.daoTreasurer),
                feeConfig.daoFee
            );
        } else {
            int256 code = _transferToken(
                _hederaService,
                feeConfig.tokenAddress,
                msg.sender,
                feeConfig.daoTreasurer,
                feeConfig.daoFee
            );
            require(
                code == HederaResponseCodes.SUCCESS,
                "DAOConfiguration: Transfer Token To DAO Treasurer Failed."
            );
        }
    }

    function _setFeeConfigInternally(
        address _receiver,
        address _token,
        uint256 _amountOrId
    ) private {
        require(
            _amountOrId > 0 && _receiver != address(0),
            "DAOConfiguration: Invalid DAO Config Data."
        );
        feeConfig.daoTreasurer = _receiver;
        feeConfig.tokenAddress = _token;
        feeConfig.daoFee = _amountOrId;
        emit FeeConfigUpdated(feeConfig);
    }
}
