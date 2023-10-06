// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "../common/IEvents.sol";
import "../common/TokenOperations.sol";

import "../holder/IAssetsHolder.sol";

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract AssetsHolder is
    IEvents,
    IAssetsHolder,
    TokenOperations,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    event TokenCreated(address indexed token);

    string private constant HederaService = "HederaService";

    address public governanceToken;
    IHederaService private iHederaService;

    uint256[49] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    receive() external payable {}

    function initialize(
        address _governanceToken,
        IHederaService _iHederaService
    ) public override initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        iHederaService = _iHederaService;
        governanceToken = _governanceToken;
        _associateTokenInteranlly(_governanceToken);
        emit LogicUpdated(address(0), address(iHederaService), HederaService);
    }

    function associate(address _token) external override onlyOwner {
        _associateTokenInteranlly(_token);
    }

    function createToken(
        string memory _name,
        string memory _symbol,
        uint256 _initialTotalSupply
    ) external payable override onlyOwner {
        (int256 code, address token) = super.createTokenWithContractAsOwner(
            iHederaService,
            _name,
            _symbol,
            _initialTotalSupply,
            8
        );
        require(
            code == HederaResponseCodes.SUCCESS,
            "AH: token creation failed"
        );
        emit TokenCreated(token);
    }

    function mintToken(
        address _token,
        uint256 _amount
    ) external override onlyOwner {
        (int256 code, ) = super.mintToken(iHederaService, _token, _amount);
        require(code == HederaResponseCodes.SUCCESS, "AH: minting failed");
    }

    function burnToken(
        address _token,
        uint256 _amount
    ) external override onlyOwner {
        (int256 code, ) = super.burnToken(iHederaService, _token, _amount);
        require(code == HederaResponseCodes.SUCCESS, "AH: burn failed");
    }

    function transfer(
        address to,
        address token,
        uint256 amount
    ) external override onlyOwner nonReentrant {
        if (address(token) == address(0)) {
            AddressUpgradeable.sendValue(payable(to), amount);
        } else {
            int256 code = _transferToken(
                iHederaService,
                token,
                address(this),
                to,
                amount
            );
            require(code == HederaResponseCodes.SUCCESS, "AH: transfer failed");
        }
    }

    function setText() external override onlyOwner {}

    function upgradeProxy(
        address _proxy,
        address _proxyLogic,
        address _proxyAdmin
    ) external override onlyOwner {
        // step-1
        AddressUpgradeable.functionCall(
            _proxy,
            abi.encodeWithSignature("upgradeTo(address)", _proxyLogic),
            "AH: failed to upgrade proxy, verify asset-holder is owner"
        );

        // step-2
        AddressUpgradeable.functionCall(
            _proxy,
            abi.encodeWithSignature("changeAdmin(address)", _proxyAdmin),
            "AH: failed to change admin, verify asset-holder is owner"
        );
    }

    function upgradeHederaService(
        IHederaService _iHederaService
    ) external override onlyOwner {
        emit LogicUpdated(
            address(iHederaService),
            address(_iHederaService),
            HederaService
        );
        iHederaService = _iHederaService;
    }

    function _associateTokenInteranlly(address _token) internal {
        int256 code = _associateToken(iHederaService, address(this), _token);
        require(
            code == HederaResponseCodes.TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT ||
                code == HederaResponseCodes.SUCCESS,
            "AH: association failed"
        );
    }

    function getHederaServiceVersion()
        external
        view
        override
        returns (IHederaService)
    {
        return iHederaService;
    }
}
