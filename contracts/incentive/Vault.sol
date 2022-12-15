// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../common/hedera/HederaResponseCodes.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "../common/IBaseHTS.sol";
import "./IVault.sol";

contract Vault is IVault, HederaResponseCodes, Initializable {
    
    event VaultAdded(IVault vault, uint256 multiplier);
    uint256 _amount;
    
    function initialize(uint256 amount) public initializer {
        _amount = amount;
    }

    function getStakedTokenCount() external view override returns (uint256) {
        return _amount;
    }
}
