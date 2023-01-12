//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../LPToken.sol";

contract MockLPToken is LPToken {
    function setLPToken(IERC20 token) public {
        lpToken = token;
    }
}
