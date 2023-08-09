@GovernorTokenTransfer
@TestSuite-3
Feature: GovernorTokenTransfer e2e test

    This feature file contains e2e test for governor transfer token

    #  GTT - Governor Token Transfer
    #  default allowance for proposal creation is 1 token
    #  governance must hold the required assets before transfer
    #  receiver must associate the token first
    #  governance having token association proposal
    #  governance having token transfer proposal

    Scenario: Verify user initialize GTT contract, lock tokens for voting and associate token to receiver for subsequent scenarios where locking, association etc are required
        Given User deploy contracts "GODTokenHolderFactory,GovernorTransferToken"
        Given User have initialized the contracts
        When User setup 10001 as allowance for voting
        When User lock 10001 GOD tokens for voting
        Then User verify the locked tokens amount in holder
        When User Associate the transfer token to receiver account

    Scenario: Verify canceling proposal changes its state to cancelled
        When User setup default allowance for GTT proposal creation
        When User create a token transfer proposal with title "testtitle" description "testdescription" link "testlink" and token amount 1
        Then User verify that proposal state is "Pending"
        When User wait for proposal state to be "Active" for max 5 seconds         
        Then User verify that proposal state is "Active"
        When User cancel the proposal with title "testtitle"
        Then User verify that proposal state is "Canceled"

    Scenario: Verify proposal state is defeated if required votes are not in favour
        When User setup default allowance for GTT proposal creation
        When User create a token transfer proposal with title "sampletesttitle" description "testdescription" link "testlink" and token amount 1
        When User wait for proposal state to be "Active" for max 5 seconds 
        Then User verify that proposal state is "Active"
        When User vote "Against" proposal
        When User wait for proposal state to be "Defeated" for max 15 seconds 
        Then User verify that proposal state is "Defeated"
        When User cancel the proposal with title "sampletesttitle"

    Scenario: Verify proposal state is defeated if no body voted on it
        When User setup default allowance for GTT proposal creation
        When User create a token transfer proposal with title "testtitlesamples" description "testdescription" link "testlink" and token amount 1
        When User wait for proposal state to be "Defeated" for max 15 seconds
        Then User verify that proposal state is "Defeated"
        When User cancel the proposal with title "testtitlesamples"

    Scenario: Verify governor text proposal state is not changed if user abstain from voting
        When User setup default allowance for GTT proposal creation
        When User create a token transfer proposal with title "proposal-with-abstain" description "testdescription" link "testlink" and token amount 1
        When User wait for proposal state to be "Active" for max 5 seconds 
        Then User verify that proposal state is "Active"
        When User vote "Abstain" proposal
        Then User verify that proposal state is "Active"
        When User cancel the proposal with title "proposal-with-abstain"

    Scenario: Verify user can not create proposal with same title 
        When User setup default allowance for GTT proposal creation
        When User create a token transfer proposal with title "testtitle" description "testdescription" link "testlink" and token amount 1
        Then User gets message "CONTRACT_REVERT_EXECUTED"     
    
    Scenario: Verify user can not create proposal with empty title 
        When User setup default allowance for GTT proposal creation
        When User create a token transfer proposal with title "" description "testdescription" link "testlink" and token amount 1
        Then User gets message "CONTRACT_REVERT_EXECUTED"      

    Scenario: Verify user can not create proposal if User don't have GOD tokens
        When User with no GOD token create a new proposal with title "testtitle" description "testdescription" link "testlink" and token amount 1
        Then User gets message "CONTRACT_REVERT_EXECUTED"

    Scenario: Verify proposal creation should be failed for -ve transfer amount
        When User create a token transfer proposal with title "negative amount proposal" description "testdescription" link "testlink" and token amount -1
        Then User gets message "CONTRACT_REVERT_EXECUTED"

    Scenario: Verify proposal creation should be failed if user don't setup the default allowance call
        When User create a token transfer proposal with title "no allowance for proposal creation" description "testdescription" link "testlink" and token amount 1
        Then User gets message "CONTRACT_REVERT_EXECUTED"

    Scenario: Verify token association and transfer journey
        When User setup default allowance for GTT proposal creation
        When User create a token association proposal with title "TokenAssociation1 - Title", description "TokenAssociation - Desc", link "TokenAssociation - Link"
        When User wait for proposal state to be "Active" for max 5 seconds 
        Then User verify that proposal state is "Active"
        When User vote "For" proposal  
        When User wait for proposal state to be "Succeeded" for max 15 seconds 
        Then User verify that proposal state is "Succeeded"
        When User execute the proposal with title "TokenAssociation1 - Title"
        Then User verify that proposal state is "Executed"

        When User setup default allowance for GTT proposal creation
        When User create a token transfer proposal with title "sampletitle" description "testdescription" link "testlink" and token amount 1
        When User wait for proposal state to be "Active" for max 5 seconds 
        Then User verify that proposal state is "Active"
        When User vote "For" proposal  
        When User wait for proposal state to be "Succeeded" for max 15 seconds 
        Then User verify that proposal state is "Succeeded"

        When User treasury transfer amount to GTT contract
        When User fetches token balance from GTT contract
        When User fetches token balance from receiver account
    
        When User execute the proposal with title "sampletitle"
        Then User verify that proposal state is "Executed"
        Then User verify that token is transferred from GTT contract  
        Then User verify that token is transferred to receiver account 

    Scenario: Verify proposal execution should be failed if GTT don't have enough token balance
        When User setup default allowance for GTT proposal creation
        When User create a token transfer proposal with title "higher-amount-proposal" description "testdescription" link "testlink" and token amount 100000000
        When User wait for proposal state to be "Active" for max 5 seconds 
        Then User verify that proposal state is "Active"
        When User vote "For" proposal  
        When User wait for proposal state to be "Succeeded" for max 15 seconds 
        Then User verify that proposal state is "Succeeded"    
        When User execute the proposal with title "higher-amount-proposal"
        Then User gets message "CONTRACT_REVERT_EXECUTED"
        When User cancel the proposal with title "higher-amount-proposal"
        
    Scenario: Verify god tokens and allowance reset successfully
        When User get locked tokens back from holder for GTT
        When User reset default allowance for GTT proposals
        When User get assets back from GTT
