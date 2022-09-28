// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.6.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "./common/hedera/HederaTokenService.sol";
import "./common/hedera/IHederaTokenService.sol";
import "./common/hedera/HederaResponseCodes.sol";
import "./common/hedera/ExpiryHelper.sol";

/// This is a notional example of how the functions in HIP-358 could be used.
/// It is non-normative.
contract CreateToken is HederaTokenService, ExpiryHelper {

    using Bits for uint;

     function getBalance() public view returns (uint) {
        return address(this).balance;
    }

    function transferHbar(address payable _receiverAddress, uint _amount) public {
        _receiverAddress.transfer(_amount);
    }

    // create a fungible Token with no custom fees, with calling contract as
    // admin key, passed ED25519 key as supply and pause key.
    function createFungible(uint32 autoRenewPeriod) external payable returns (address createdTokenAddress) {
        IHederaTokenService.HederaToken memory myToken;
        myToken.name = "Wrapped Hbar";
        myToken.symbol = "WHBAR";
        myToken.treasury = address(this);
        myToken.expiry = createAutoRenewExpiry(address(this), autoRenewPeriod);

        (int responseCode, address _token) = createFungibleToken(myToken, 10, 8);
        require(responseCode == HederaResponseCodes.SUCCESS, "Create token should be successful.");
        return _token;
    }
}

library Bits {

    uint constant internal ONE = uint(1);

    // Sets the bit at the given 'index' in 'self' to '1'.
    // Returns the modified value.
    function setBit(uint self, uint8 index) internal pure returns (uint) {
        return self | ONE << index;
    }
}