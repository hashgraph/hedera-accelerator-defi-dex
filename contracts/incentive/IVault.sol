// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../common/IBaseHTS.sol";

interface IVault {
    function getStakedTokenCount() external returns (uint256);
}
