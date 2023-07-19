@GovernorTransferToken
@TestSuite-3
Feature: GovernorTransferToken e2e test

    This feature file contains e2e test for governor transfer token

    #  default allowance for proposal creation is 1 token

    Scenario: Verify user can create a proposal for transferring token
        Given User have initialized the governor transfer token contract
        When User setup 10001 as allowance amount for token locking for transfer token proposal
        When User setup default allowance for token transfer proposal creation
        When User create a new proposal with unique title "testtitle" description "testdescription" link "testlink" and token amount 1
        Then User verify that proposal state is "Pending"
        When User wait for proposal state to be "Active" for max 5 seconds         
        Then User verify that proposal state is "Active"
        When User cancel the proposal with title "testtitle"
        

    Scenario: Verify user can not create proposal with same title 
        When User create a new proposal with duplicate title "testtitle" description "testdescription" link "testlink" and token amount 1
        Then User gets message "CONTRACT_REVERT_EXECUTED" on creating proposal        

    Scenario: Verify user can not create proposal if User do n't have GOD tokens
        When User with no GOD token create a new proposal with title "testtitle" description "testdescription" link "testlink" and token amount 1
        Then User gets message "CONTRACT_REVERT_EXECUTED" on creating proposal

    Scenario: Verify proposal complete journey
        When User fetches token balance of the payee account
        When User setup 10001 as allowance amount for token locking for transfer token proposal
        When User setup default allowance for token transfer proposal creation
        When User create a new proposal with unique title "sampletitle" description "testdescription" link "testlink" and token amount 1
        When User wait for proposal state to be "Active" for max 5 seconds 
        Then User verify that proposal state is "Active"
        When User lock 10001 GOD token before voting to transfer token proposal
        When User vote "For" proposal  
        When User wait for proposal state to be "Succeeded" for max 15 seconds 
        Then User verify that proposal state is "Succeeded"
        When User setup 1 as allowance amount of token which needs to be transferred
        When User execute the proposal with title "sampletitle"
        Then User verify that proposal state is "Executed"
        Then User verify that token is transferred to payee account  
        
    Scenario: Verify canceling proposal changes its state to cancelled
        When User setup 10001 as allowance amount for token locking for transfer token proposal
        When User setup default allowance for token transfer proposal creation
        When User create a new proposal with unique title "sampletest" description "testdescription" link "testlink" and token amount 1
        When User wait for proposal state to be "Active" for max 5 seconds 
        When User cancel the proposal with title "sampletest"
        Then User verify that proposal state is "Canceled"

    Scenario: Verify proposal state is defeated if required votes are not in favour
        When User setup 10001 as allowance amount for token locking for transfer token proposal
        When User setup default allowance for token transfer proposal creation
        When User create a new proposal with unique title "sampletesttitle" description "testdescription" link "testlink" and token amount 1
        When User wait for proposal state to be "Active" for max 5 seconds 
        Then User verify that proposal state is "Active"
        When User lock 10001 GOD token before voting to transfer token proposal
        When User vote "Against" proposal
        When User wait for proposal state to be "Defeated" for max 15 seconds 
        Then User verify that proposal state is "Defeated"
        When User cancel the proposal with title "sampletesttitle"
        

    Scenario: Verify proposal state is defeated if no body voted on it
        When User setup 10001 as allowance amount for token locking for transfer token proposal
        When User setup default allowance for token transfer proposal creation
        When User create a new proposal with unique title "testtitlesamples" description "testdescription" link "testlink" and token amount 1
        When User wait for proposal state to be "Defeated" for max 15 seconds
        Then User verify that proposal state is "Defeated"
        When User cancel the proposal with title "testtitlesamples"

    Scenario: Verify user gets back locked GOD tokens
        When User fetches GOD token back from GOD holder for GovernorTransferToken

    Scenario: User reset allowance
        When User setup 0 as allowance amount for token locking for transfer token proposal
        When User setup 0 as allowance amount of token which needs to be transferred
