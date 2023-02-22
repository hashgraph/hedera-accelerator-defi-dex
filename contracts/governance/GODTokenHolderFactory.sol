// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../common/IERC20.sol";
import "../common/IBaseHTS.sol";
import "../common/hedera/HederaResponseCodes.sol";
import "./IGODHolder.sol";

contract GODTokenHolderFactory {
    error GODHolderAlreadyExist(
        address token,
        address godTokenHolder,
        string message
    );
    mapping(IERC20 => IGODHolder) godTokenToHolderContractMap;
    IGODHolder[] allGODHolders;

    function createGODHolder(IGODHolder _godHolder) public {
        IERC20 _token = _godHolder.getGODToken();
        IGODHolder godHolder = godTokenToHolderContractMap[_token];

        if (address(godHolder) != address(0x0)) {
            revert GODHolderAlreadyExist({
                token: address(_token),
                godTokenHolder: address(godHolder),
                message: "GODHolder already exist for this token."
            });
        }

        allGODHolders.push(_godHolder);
        godTokenToHolderContractMap[_godHolder.getGODToken()] = _godHolder;
    }

    function getGODTokenHolder(IERC20 _token) public view returns (IGODHolder) {
        return godTokenToHolderContractMap[_token];
    }
}
