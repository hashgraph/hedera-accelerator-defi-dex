//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.18;

interface ISharedDAOModel {
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
        address[] owners;
        uint256 threshold;
        bool isPrivate;
        string description;
        string[] webLinks;
    }
}
