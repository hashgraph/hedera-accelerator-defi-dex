@NFTDao
@TestSuite-4
Feature: NFTDao e2e test

    This feature file contains e2e test for NFT DAO

    #  NFTDAOFactory - NFTDAOFactory
    #  FTDAO - FTDAO
    #  GTT - GovernorTransferToken
    #  default allowance for proposal creation is 1 token
    #  governance must hold the required assets before transfer
    #  receiver must associate the token first
    #  governance having token association proposal
    #  governance having token transfer proposal

Scenario: Verify user initialize NFTDAOFactory contract
        When User deploy the following contracts "NFTTokenHolderFactory,NFTDAOFactory"
        When User gets the instances of deployed contracts

Scenario: Verify user can't create DAO with empty name
        Given User create a NFT DAO with name "" and url "https://hedera.com"
        Then User receive the error message "CONTRACT_REVERT_EXECUTED" 

Scenario: Verify user can create DAO with non-empty name, lock nft serial for voting and associate token to receiver for subsequent scenarios where locking, association etc are required
        When User create a NFT DAO with name "DAO-ONE" and url "https://hedera.com"
        Then User verify that created NFT DAO address is available
        When User setup nft-token allowance for voting
        When User lock nft-token serial no 10 for the voting
        Then User verify locked nft-token count in holder
        When User associate token to receiver account

Scenario: Verify token association and transfer journey
        When User set nft allowance for GTT proposal creation
        When User creates the token association proposal with title "TokenAssociation1 - Title"
        When User waits for the proposal state to be "Active" for max 5 seconds 
        Then User verify nft proposal state is "Active"
        When User given vote "For" proposal  
        When User waits for the proposal state to be "Succeeded" for max 15 seconds 
        Then User verify nft proposal state is "Succeeded"
        When User executes proposal with title "TokenAssociation1 - Title"
        Then User verify nft proposal state is "Executed"

        When User set nft allowance for GTT proposal creation
        When User creates token transfer proposal with title "sampletitle" description "testdescription" link "testlink" and token amount 1
        When User waits for the proposal state to be "Active" for max 5 seconds 
        Then User verify nft proposal state is "Active"
        When User given vote "For" proposal  
        When User waits for the proposal state to be "Succeeded" for max 15 seconds 
        Then User verify nft proposal state is "Succeeded"

        When User transfer proposed amount to GTT contract
        When User get the token balance from GTT contract
        When User get the token balance from receiver account
    
        When User executes proposal with title "sampletitle"
        Then User verify nft proposal state is "Executed"
        Then User verify proposed token amount is transferred from GTT contract  
        Then User verify proposed token amount is transferred to receiver account  

Scenario: Verify nft tokens and allowance reset successfully
        When User get the locked nft-token serial no back from holder
        When User reset nft allowance from contracts
        When User get the locked assets back from GTT
