// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./IVault.sol";

contract Vault is IVault, Initializable {
    uint256 _amount;

    function initialize(uint256 amount) public initializer {
        _amount = amount;
    }

    function getStakedTokenCount() external view override returns (uint256) {
        return _amount;
    }
}
