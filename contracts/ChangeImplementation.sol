//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.17;
import "./common/ProxyPattern.sol";

contract ChangeImplementation {
    function swap(address payable proxy, address impl) external {
        ProxyPattern(proxy).changeAdmin(address(this));
        ProxyPattern(proxy).upgradeTo(impl);
        ProxyPattern(proxy).changeAdmin(msg.sender);
    }
}
