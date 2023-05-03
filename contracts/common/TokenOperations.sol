// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./IERC20.sol";
import "./IERC721.sol";
import "./IBaseHTS.sol";

contract TokenOperations {
    function _balanceOf(
        address token,
        address account
    ) internal view returns (uint256) {
        return IERC20(token).balanceOf(account);
    }

    function _associateToken(
        IBaseHTS _baseHTS,
        address _account,
        address _token
    ) internal returns (int256 code) {
        if (isContract(_account)) {
            return associateTokenViaDelegation(_baseHTS, _account, _token);
        }
        return _baseHTS.associateTokenPublic(_account, _token);
    }

    function _transferToken(
        address _token,
        address _sender,
        address _receiver,
        int256 _amount
    ) internal returns (int256 responseCode) {
        bool isTransferSuccessful = isContractSendingTokens(_sender)
            ? IERC20(_token).transfer(_receiver, uint256(_amount))
            : IERC20(_token).transferFrom(_sender, _receiver, uint256(_amount));

        return
            isTransferSuccessful
                ? HederaResponseCodes.SUCCESS
                : HederaResponseCodes.UNKNOWN;
    }

    function _transferNFTToken(
        address _token,
        address _sender,
        address _receiver,
        int256 _amount
    ) internal {
        IERC721(_token).transferFrom(_sender, _receiver, uint256(_amount));
    }

    function isContract(address _account) private view returns (bool) {
        return _account.code.length > 0;
    }

    /// @custom:oz-upgrades-unsafe-allow delegatecall
    function associateTokenViaDelegation(
        IBaseHTS _baseHTS,
        address _account,
        address _token
    ) private returns (int256 code) {
        (bool success, bytes memory result) = address(_baseHTS).delegatecall(
            abi.encodeWithSelector(
                IBaseHTS.associateTokenPublic.selector,
                _account,
                _token
            )
        );
        code = success
            ? abi.decode(result, (int256))
            : HederaResponseCodes.UNKNOWN;
    }

    function isContractSendingTokens(
        address sender
    ) private view returns (bool) {
        return sender == address(this);
    }
}
