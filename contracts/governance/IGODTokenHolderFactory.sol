// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;
import "../common/IERC20.sol";
import "../common/IBaseHTS.sol";
import "./IGODHolder.sol";

interface IGODTokenHolderFactory {
    event LogicUpdated(
        address indexed oldImplementation,
        address indexed newImplementation,
        string name
    );

    event GODHolderCreated(
        address token,
        address godHolder
    );

    function initialize(
        IBaseHTS _tokenService,
        IGODHolder _godHolderLogic,
        address _admin
    ) external;

    function getGODTokenHolder(IERC20 _token) external returns (IGODHolder);

    function upgradeGodHolderLogicImplementation(IGODHolder _newImpl) external;
}
