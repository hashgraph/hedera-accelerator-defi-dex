// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;
import "../common/IERC20.sol";
import "../common/IBaseHTS.sol";
import "./ITokenHolder.sol";

interface ITokenHolderFactory {
    event LogicUpdated(
        address indexed oldImplementation,
        address indexed newImplementation,
        string name
    );

    event TokenHolderCreated(address token, address tokenHolder);

    function initialize(
        IBaseHTS _tokenService,
        ITokenHolder _tokenHolderLogic,
        address _admin
    ) external;

    function getTokenHolder(address _token) external returns (ITokenHolder);

    function upgradeTokenHolderLogicImplementation(
        ITokenHolder _newImpl
    ) external;
}
