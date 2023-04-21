//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./DAOFactory.sol";

contract GovernanceDAOFactory is DAOFactory {
    event GovernanceDAOCreated(DAODetails daoDetails);

    function emitGovernanceDAOCreated(
        DAODetails memory governanceDAODetails
    ) internal {
        emit GovernanceDAOCreated(governanceDAODetails);
    }

    function createDAO(
        address _admin,
        string calldata _name,
        string calldata _logoUrl,
        IERC20 _tokenAddress,
        uint256 _quorumThreshold,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        bool _isPrivate
    ) external returns (address) {
        return
            super.createDAO(
                _admin,
                _name,
                _logoUrl,
                _tokenAddress,
                VotingRules(_quorumThreshold, _votingDelay, _votingPeriod),
                _isPrivate,
                emitGovernanceDAOCreated
            );
    }
}
