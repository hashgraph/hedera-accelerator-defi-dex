// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;

contract ProxyPatternMock {
    address logicAddress;
    address adminAddress;

    constructor(address _logic, address _admin) {
        logicAddress = _logic;
        adminAddress = _admin;
    }

    modifier ifAdmin() {
        require(msg.sender == adminAddress, "Not admin");
        _;
    }

    function upgradeTo(address _newImpl) public ifAdmin {
        logicAddress = _newImpl;
    }

    function changeAdmin(address _newAdmin) public ifAdmin {
        adminAddress = _newAdmin;
    }

    function implementation() public view ifAdmin returns (address) {
        return logicAddress;
    }

    function admin() public view ifAdmin returns (address) {
        return adminAddress;
    }
}
