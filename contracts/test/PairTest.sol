// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "../common/hedera/HederaResponseCodes.sol";
import "../common/IBaseHTS.sol";
import "../ILPToken.sol";
import "../AbstractPair.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract PairTest is AbstractPair {

    function initialize(IBaseHTS _tokenService, ILPToken _lpTokenContract) public virtual override {
        tokenService = _tokenService;
        creator = msg.sender;
        lpTokenContract = _lpTokenContract;
    }
    
    constructor(IBaseHTS _tokenService, ILPToken _lpTokenContract) {
        tokenService = _tokenService;
        creator = msg.sender;
        lpTokenContract = _lpTokenContract;
    }

    function associateToken(address account, address token)
        internal
        virtual
        override
        returns (int256)
    {
        return tokenService.associateTokenPublic(account, token);
    }

    function transferToken(
        address token,
        address sender,
        address receiver,
        int256 amount
    ) internal virtual override returns (int256) {
        return
            tokenService.transferTokenPublic(token, sender, receiver, amount);
    }
}
