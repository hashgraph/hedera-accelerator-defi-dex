//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

interface ISharedModel {
    struct CreateDAOInputs {
        address admin;
        string name;
        string logoUrl;
        string infoUrl;
        address tokenAddress;
        uint256 quorumThreshold;
        uint256 votingDelay;
        uint256 votingPeriod;
        bool isPrivate;
        string description;
        string[] webLinks;
    }

    struct MultiSigCreateDAOInputs {
        address admin;
        string name;
        string logoUrl;
        string infoUrl;
        address[] owners;
        uint256 threshold;
        bool isPrivate;
        string description;
        string[] webLinks;
    }

    struct GovernorConfig {
        uint256 votingDelay;
        uint256 votingPeriod;
        uint256 quorumThresholdInBsp;
    }

    struct FeeConfig {
        address receiver;
        address tokenAddress;
        uint256 amountOrId;
    }
}
