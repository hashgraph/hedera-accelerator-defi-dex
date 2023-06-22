//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;
import "../governance/IGovernorTransferToken.sol";
import "../common/IHederaService.sol";
import "../governance/ITokenHolderFactory.sol";

interface ISharedDAOModel {
    struct Governor {
        address tokenTransferLogic;
        address textLogic;
        address contractUpgradeLogic;
        address createTokenLogic;
    }

    struct CreateDAOInputs {
        address admin;
        string name;
        string logoUrl;
        address tokenAddress;
        uint256 quorumThreshold;
        uint256 votingDelay;
        uint256 votingPeriod;
        bool isPrivate;
        string description;
        string[] webLinks;
    }

    struct Common {
        IHederaService hederaService;
        ITokenHolder iTokenHolder;
        address proxyAdmin;
        address systemUser;
    }

    event GovernorLogicUpdated(
        Governor oldImplementation,
        Governor newImplementation,
        string name
    );
}
