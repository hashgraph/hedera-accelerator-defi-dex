// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;

import "./IERC20.sol";
import "./IBaseHTS.sol";

contract TokenOperations {
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
        IBaseHTS _baseHTS,
        address _token,
        address _sender,
        address _receiver,
        int256 _amount
    ) internal returns (int256 responseCode) {
        if (_sender == address(this)) {
            bool success = IERC20(_token).transfer(_receiver, uint256(_amount));
            return
                success
                    ? HederaResponseCodes.SUCCESS
                    : HederaResponseCodes.UNKNOWN;
        }
        return
            _baseHTS.transferTokenPublic(_token, _sender, _receiver, _amount);
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
}
