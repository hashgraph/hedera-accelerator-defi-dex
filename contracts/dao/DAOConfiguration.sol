//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

import "./ISharedDAOModel.sol";
import "../common/TokenOperations.sol";
import "../common/IHederaService.sol";

contract DAOConfiguration is ISharedDAOModel, TokenOperations {
    DAOConfigDetails internal daoConfig;

    struct DAOConfigDetails {
        address payable daoTreasurer;
        address tokenAddress;
        uint256 daoFee;
    }
    event DAOConfig(DAOConfigDetails daoConfig);

    modifier DAOTreasureOnly() {
        require(msg.sender == daoConfig.daoTreasurer, "DAO treasurer only.");
        _;
    }

    function changeDAOConfig(
        address payable daoTreasurer,
        address tokenAddress,
        uint256 daoFee
    ) external DAOTreasureOnly {
        require(
            daoFee > 0 && daoTreasurer != payable(address(0)),
            "Invalid DAO Config Data."
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
            require(sent, "Transfer HBAR To DAO Treasurer Failed");
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
                "Transfer Token To DAO Treasurer Failed"
            );
        }
    }
}
