//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "../common/ISharedModel.sol";
import "../common/TokenOperations.sol";
import "../common/IHederaService.sol";

contract DAOConfiguration is ISharedModel, TokenOperations {
    struct DAOConfigDetails {
        address payable daoTreasurer;
        address tokenAddress;
        uint256 daoFee;
    }
    event DAOConfig(DAOConfigDetails daoConfig);

    DAOConfigDetails internal daoConfig;

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[49] private __gap;

    modifier DAOTreasureOnly() {
        require(
            msg.sender == daoConfig.daoTreasurer,
            "DAOConfiguration: DAO treasurer only."
        );
        _;
    }

    function changeDAOConfig(
        address payable daoTreasurer,
        address tokenAddress,
        uint256 daoFee
    ) external DAOTreasureOnly {
        require(
            daoFee > 0 && daoTreasurer != payable(address(0)),
            "DAOConfiguration: Invalid DAO Config Data."
        );
        daoConfig.daoFee = daoFee;
        daoConfig.tokenAddress = tokenAddress;
        daoConfig.daoTreasurer = daoTreasurer;
        emit DAOConfig(daoConfig);
    }

    function getDAOConfigDetails()
        external
        view
        returns (DAOConfigDetails memory)
    {
        return daoConfig;
    }

    function payDAOCreationFee(IHederaService _hederaService) internal {
        bool isHbarToken = daoConfig.tokenAddress == address(0);
        if (isHbarToken) {
            (bool sent, ) = daoConfig.daoTreasurer.call{
                value: daoConfig.daoFee
            }("");
            require(
                sent,
                "DAOConfiguration: Transfer HBAR To DAO Treasurer Failed."
            );
        } else {
            int256 responseCode = _transferToken(
                _hederaService,
                daoConfig.tokenAddress,
                msg.sender,
                daoConfig.daoTreasurer,
                daoConfig.daoFee
            );
            require(
                responseCode == HederaResponseCodes.SUCCESS,
                "DAOConfiguration: Transfer Token To DAO Treasurer Failed."
            );
        }
    }
}
