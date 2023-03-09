//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./common/IBaseHTS.sol";
import "./common/IERC20.sol";

contract DummyContract is Initializable, HederaTokenService {
    IBaseHTS tokenService;
    address token;

    function initialize(
        IBaseHTS _tokenService,
        address _token
    ) external initializer {
        tokenService = _tokenService;
        token = _token;
    }

    function transferToContract(address creator, int256 amt) external {
        int256 responseCode = tokenService.transferTokenPublic(
            address(token),
            creator,
            address(this),
            int64(amt)
        );
        if (responseCode != 22) {
            revert("transferToContract: token transfer failed to contract.");
        }
    }

    function transferFromContract(int256 amt) external {
        int256 responseCode = transferToken(
            address(token),
            address(this),
            msg.sender,
            int64(amt)
        );
        if (responseCode != 22) {
            revert(
                "transferFromContract: token transfer failed from contract."
            );
        }
    }

    function transferFromContractViaDepUsingErc20(int256 amt) external {
        bool result = tokenService.transferViaErc20(
            address(this),
            msg.sender,
            address(token),
            uint256(amt)
        );
        require(result, "transferFromContractViaDepUsingErc20 failed");
    }

    function transferFromContractViaDep(int256 amt) external {
        int256 responseCode = tokenService.transferTokenPublic(
            address(token),
            address(this),
            msg.sender,
            int64(amt)
        );
        if (responseCode != 22) {
            revert(
                "transferFromContract: token transfer failed from contract."
            );
        }
    }

    function transferFromContractViaErc20(int256 amt) external {
        bool result = IERC20(token).transfer(msg.sender, uint(amt));
        require(result, "ERC20 transfer failed");
    }

    function balanceOf(address _token, bytes memory data) external {
        (bool success, ) = _token.call(data);
        require(success, "ERC20 transfer failed");
    }
}
