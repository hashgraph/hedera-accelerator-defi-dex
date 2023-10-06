// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "../common/IHederaService.sol";

interface IAssetsHolder {
    function initialize(
        address _governanceToken,
        IHederaService _iHederaService
    ) external;

    function associate(address _token) external;

    function createToken(
        string memory _name,
        string memory _symbol,
        uint256 _initialTotalSupply
    ) external payable;

    function mintToken(address _token, uint256 _amount) external;

    function burnToken(address _token, uint256 _amount) external;

    function transfer(address _to, address _token, uint256 _amount) external;

    function setText() external;

    function upgradeProxy(
        address _proxy,
        address _proxyLogic,
        address _proxyAdmin
    ) external;

    function upgradeHederaService(IHederaService _newIHederaService) external;

    function getHederaServiceVersion() external view returns (IHederaService);
}
