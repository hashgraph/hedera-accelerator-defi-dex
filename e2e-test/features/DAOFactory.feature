@TestSuite-9
Feature: DAOFactory e2e test

    This feature file contains e2e test for DAO Governor Token

    #  FTDAOFactory
    #  NFTDAOFactory
    #  HederaGovernor
    #  FTDAO

Scenario: Verify user initialize DAOFactory contract based on FT Token
        When User creates the DAOFactory for token-id "0.0.2726163"
        Then User setup dao creation fee for token-id "0.0.0" with amount/id "1"
        Then User gets initialized contracts

Scenario: Verify user can't create DAO with empty name
        When User create a DAO with name ""
        Then User gets the message "CONTRACT_REVERT_EXECUTED"

Scenario: Verify user can create DAO with non-empty name
        When User create a DAO with name "DAO-ONE"
        Then User verify that created dao and its properties available

Scenario: Verify user initialize DAOFactory contract based on NFT Token
        When User creates the DAOFactory for token-id "0.0.2726474"
        Then User setup dao creation fee for token-id "0.0.2726163" with amount/id "1"
        Then User gets initialized contracts

Scenario: Verify user can't create DAO with empty name
        When User create a DAO with name ""
        Then User gets the message "CONTRACT_REVERT_EXECUTED"

Scenario: Verify user can create DAO with non-empty name
        When User create a DAO with name "DAO-ONE"
        Then User verify that created dao and its properties available


