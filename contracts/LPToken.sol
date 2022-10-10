//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./common/hedera/HederaResponseCodes.sol";
import "./common/IBaseHTS.sol";
import "./AbstractLPToken.sol";

contract LPToken is AbstractLPToken {

    function mintToken(int amount, address token) override internal virtual returns (int responseCode, int newTotalSupply) {
        (responseCode, newTotalSupply) = tokenService.mintTokenPublic(token, amount);
    }

    function burnToken(int amount, address token) override internal virtual returns (int) {
        (int responseCode,) = tokenService.burnTokenPublic(token, amount);
        return responseCode;
    }

    function associateTokenInternal(address account,  address _token) internal override  virtual returns(int) {
        return tokenService.associateTokenPublic(account, _token);
    }

    function transferTokenInternal(address _token, address sender, address receiver, int amount) internal override virtual returns(int) {
        return tokenService.transferTokenPublic(_token, sender, receiver, amount);
    }
    
    function createFungibleTokenInternal(IHederaTokenService.HederaToken memory hederaToken,
        uint256 initialTotalSupply,
        uint256 decimals) internal       override
returns (int responseCode, address tokenAddress) {
        (bool success, bytes memory result) = address(tokenService).delegatecall(
            abi.encodeWithSelector(IBaseHTS.createFungibleTokenPublic.selector,  hederaToken, initialTotalSupply, decimals));
        return success ? abi.decode(result, (int, address)) : (int(HederaResponseCodes.UNKNOWN), address(0x0));
    }
}
