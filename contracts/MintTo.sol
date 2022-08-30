// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "./common/hedera/HederaResponseCodes.sol";
import "./common/hedera/HederaTokenService.sol";

abstract contract HederaToken {
    function name() public virtual view returns(string memory);
}

contract MintTo is HederaTokenService {

    address tokenAddress;

    function getName() public view returns (string memory) {
        HederaToken token = HederaToken(tokenAddress);
        return token.name();
    }

    function setToken(address _tokenAddress) external {
        tokenAddress = _tokenAddress;
    }

    function mintTo(address _receiver) external {

        int64 intOneToken = 1;
        uint64 uIntOneToken = 1;

        (int response, uint64 newTotalSupply, int64[] memory serialNumbers) = HederaTokenService.mintToken(tokenAddress, uIntOneToken, new bytes[](0));

        if (response != HederaResponseCodes.SUCCESS) {
            revert ("Mint Failed");
        }
        response = HederaTokenService.transferToken(tokenAddress, address(this), _receiver, intOneToken);

        if (response != HederaResponseCodes.SUCCESS) {
            revert ("Transfer Failed");
        }
    }
}
