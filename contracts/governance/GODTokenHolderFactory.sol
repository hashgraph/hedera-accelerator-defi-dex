// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "../common/IERC20.sol";
import "../common/IBaseHTS.sol";
import "../common/hedera/HederaResponseCodes.sol";
import "./IGODHolder.sol";
import "./IGODTokenHolderFactory.sol";

contract GODTokenHolderFactory is IGODTokenHolderFactory, Initializable {
    string private constant GODHolder = "IGODHolder";
    IGODHolder private godHolderLogic;
    IBaseHTS tokenService;
    address private admin;
    mapping(IERC20 => IGODHolder) private godTokenToHolderContractMap;

    modifier ifAdmin() {
        require(
            msg.sender == admin,
            "GODTokenHolderFactory: Only admin can change state."
        );
        _;
    }

    function initialize(
        IBaseHTS _tokenService,
        IGODHolder _godHolderLogic,
        address _admin
    ) public initializer {
        godHolderLogic = _godHolderLogic;
        tokenService = _tokenService;
        admin = _admin;
        emit LogicUpdated(address(0), address(_godHolderLogic), GODHolder);
    }

    function getGODTokenHolder(IERC20 _token) public returns (IGODHolder) {
        IGODHolder godHolder = godTokenToHolderContractMap[_token];

        if (address(godHolder) == address(0x0)) {
            godHolder = _createGODHolder(_token);
            godTokenToHolderContractMap[_token] = godHolder;
            emit GODHolderCreated(address(_token), address(godHolder));
        }

        return godHolder;
    }

    function upgradeGodHolderLogicImplementation(
        IGODHolder _newImpl
    ) public ifAdmin {
        emit LogicUpdated(
            address(godHolderLogic),
            address(_newImpl),
            GODHolder
        );
        godHolderLogic = _newImpl;
    }

    function _createProxy() private returns (address) {
        bytes memory _data;
        return
            address(
                new TransparentUpgradeableProxy(
                    address(godHolderLogic),
                    admin,
                    _data
                )
            );
    }

    function _createGODHolder(IERC20 _token) private returns (IGODHolder) {
        address proxy = _createProxy();
        IGODHolder holder = IGODHolder(proxy);
        holder.initialize(tokenService, address(_token));
        return holder;
    }
}
