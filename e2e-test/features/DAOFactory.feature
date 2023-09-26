@TestSuite-9
Feature: DAOFactory e2e test

    This feature file contains e2e test for DAO Governor Token

    #  FTDAOFactory
    #  NFTDAOFactory
    #  HederaGovernor
    #  FTDAO

Scenario: Verify user initialize DAOFactory contract based on FT Token
        Given User creates the DAOFactory for token-id "0.0.80158"
        When User get initialized the contracts

Scenario: Verify user can't create DAO with empty name
        When User create a DAO with name ""
        Then User gets the message "CONTRACT_REVERT_EXECUTED"

Scenario: Verify user can create DAO with non-empty name
        When User create a DAO with name "DAO-ONE"
        Then User verify that created dao and its properties available

Scenario: Verify user initialize DAOFactory contract based on NFT Token
        Given User creates the DAOFactory for token-id "0.0.2368573"
        When User get initialized the contracts

Scenario: Verify user can't create DAO with empty name
        When User create a DAO with name ""
        Then User gets the message "CONTRACT_REVERT_EXECUTED"

Scenario: Verify user can create DAO with non-empty name
        When User create a DAO with name "DAO-ONE"
        Then User verify that created dao and its properties available


