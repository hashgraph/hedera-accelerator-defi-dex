// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../common/IHederaService.sol";
import "../common/hedera/HederaResponseCodes.sol";
import "./ITokenHolder.sol";
import "./ITokenHolderFactory.sol";

contract TokenHolderFactory is
    ITokenHolderFactory,
    Initializable,
    OwnableUpgradeable
{
    string private constant TokenHolder = "ITokenHolder";
    ITokenHolder private tokenHolderLogic;
    IHederaService hederaService;
    address private admin;
    mapping(address => ITokenHolder) private tokenToHolderContractMap;
    ITokenHolder[] tokenHolders;

    modifier ifAdmin() {
        require(
            msg.sender == admin,
            "TokenHolderFactory: Only admin can change state."
        );
        _;
    }

    function initialize(
        IHederaService _hederaService,
        ITokenHolder _tokenHolderLogic,
        address _admin
    ) public initializer {
        __Ownable_init();
        tokenHolderLogic = _tokenHolderLogic;
        hederaService = _hederaService;
        admin = _admin;
        emit LogicUpdated(address(0), address(_tokenHolderLogic), TokenHolder);
    }

    function getTokenHolder(address _token) public returns (ITokenHolder) {
        ITokenHolder tokenHolder = tokenToHolderContractMap[_token];

        if (address(tokenHolder) == address(0x0)) {
            tokenHolder = _createTokenHolder(_token);
            tokenToHolderContractMap[_token] = tokenHolder;
            emit TokenHolderCreated(address(_token), address(tokenHolder));
        }
        return tokenHolder;
    }

    function upgradeTokenHolderLogicImplementation(
        ITokenHolder _newImpl
    ) public ifAdmin {
        emit LogicUpdated(
            address(tokenHolderLogic),
            address(_newImpl),
            TokenHolder
        );
        tokenHolderLogic = _newImpl;
    }

    function upgradeHederaService(
        IHederaService newHederaService
    ) external onlyOwner {
        hederaService = newHederaService;
        for (uint i = 0; i < tokenHolders.length; i++) {
            ITokenHolder holder = tokenHolders[i];
            holder.upgradeHederaService(newHederaService);
        }
    }

    function getTokenHolders() external view returns (ITokenHolder[] memory) {
        return tokenHolders;
    }

    function getHederaServiceVersion() external view returns (IHederaService) {
        return hederaService;
    }

    function _createProxy() private returns (address) {
        bytes memory _data;
        return
            address(
                new TransparentUpgradeableProxy(
                    address(tokenHolderLogic),
                    admin,
                    _data
                )
            );
    }

    function _createTokenHolder(address _token) private returns (ITokenHolder) {
        address proxy = _createProxy();
        ITokenHolder holder = ITokenHolder(proxy);
        holder.initialize(hederaService, _token);
        tokenHolders.push(holder);
        return holder;
    }
}
