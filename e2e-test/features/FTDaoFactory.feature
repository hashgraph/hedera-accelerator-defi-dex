@FTDao
@TestSuite-4
Feature: FTDao e2e test

    This feature file contains e2e test for DAO Governor Token

    #  FTDAOFactory - FTDAOFactory
    #  FTDAO - FTDAO
    #  GTT - GovernorTransferToken
    #  default allowance for proposal creation is 1 token
    #  governance must hold the required assets before transfer
    #  receiver must associate the token first
    #  governance having token association proposal
    #  governance having token transfer proposal

Scenario: Verify user initialize FTDAOFactory contract
        Given User deploy the contracts "GODTokenHolderFactory,FTDAOFactory"
        Given User have to initialized the contracts

Scenario: Verify user can't create DAO with empty name
        When User create a DAO with name "" and url "https://hedera.com"
        Then User gets the message "CONTRACT_REVERT_EXECUTED"

Scenario: Verify user can create DAO with non-empty name, lock tokens for voting and associate token to receiver
        When User create a DAO with name "DAO-ONE" and url "https://hedera.com"
        Then User verify that created dao address is available
        When User setup 10001 as the allowance for voting
        When User lock 10001 GOD tokens for the voting
        Then User verify locked tokens amount in holder
        When User Associate transfer token to receiver account

Scenario: Verify token association and transfer journey
        When User setup the default allowance for GTT proposals
        When User create token association proposal with title "TokenAssociation1 - Title", description "TokenAssociation - Desc", link "TokenAssociation - Link"
        When User wait for the proposal state to be "Active" for max 5 seconds 
        Then User verify the proposal state is "Active"
        When User voted "For" proposal  
        When User wait for the proposal state to be "Succeeded" for max 15 seconds 
        Then User verify the proposal state is "Succeeded"
        When User execute proposal with title "TokenAssociation1 - Title"
        Then User verify the proposal state is "Executed"

        When User setup the default allowance for GTT proposals
        When User create token transfer proposal with title "sampletitle" description "testdescription" link "testlink" and token amount 1
        When User wait for the proposal state to be "Active" for max 5 seconds 
        Then User verify the proposal state is "Active"
        When User voted "For" proposal  
        When User wait for the proposal state to be "Succeeded" for max 15 seconds 
        Then User verify the proposal state is "Succeeded"

        When User transfer amount to GTT contract
        When User fetch token balance from GTT contract
    
        When User execute proposal with title "sampletitle"
        Then User verify the proposal state is "Executed"
        Then User verify token is transferred from GTT contract  

Scenario: Verify god tokens and allowance reset successfully
        When User get the locked tokens back from holder for GTT
        When User reset the default allowance for GTT proposals
        When User get the assets back from GTT



