@GovernorTextProposal
@TestSuite-2
Feature: GovernorTextProposal e2e test

    This feature file contains e2e test for Governor text proposal

#  default allowance for proposal creation is 1 token 

Scenario: Verify governor text proposal execution
    Given User have initialized the governor text proposal contract
    When User setup default allowance for text proposal creation
    When User create a text proposal with title "sampletextproposal11" 
    When User wait for text proposal state to be "Active" for max 3 seconds
    Then User verify text proposal state is "Active"
    When User setup 10001 as allowance amount for token locking for text proposal
    When User lock 10001 GOD token before voting to text proposal
    When User vote "For" to text proposal    
    When User wait for text proposal state to be "Succeeded" for max 15 seconds    
    Then User verify text proposal state is "Succeeded"
    When User execute the text proposal with title "sampletextproposal11"
    When User wait for text proposal state to be "Executed" for max 5 seconds
    Then User verify text proposal state is "Executed"

Scenario: Verify governor text proposal state is not changed if user abstain from voting
    When User setup default allowance for text proposal creation
    When User create a text proposal with title "textproposal3" 
    When User wait for text proposal state to be "Active" for max 3 seconds
    Then User verify text proposal state is "Active"
    When User vote "Abstain" to text proposal
    Then User verify text proposal state is "Active"
    When User cancel the text proposal with title "textproposal3"

Scenario: Verify governor text proposal cannot create with blank title  
    When User create a text proposal with blank title     
    Then User receives "CONTRACT_REVERT_EXECUTED" error message
    
Scenario: Verify governor text proposal cancellation
    When User setup default allowance for text proposal creation
    When User create a text proposal with title "sampletextproposal44" 
    When User wait for text proposal state to be "Active" for max 3 seconds
    Then User verify text proposal state is "Active"
    When User cancel the text proposal with title "sampletextproposal44"
    Then  User verify text proposal state is "Canceled"

Scenario: Verify user gets back locked GOD tokens for GovernorText
     When User fetch GOD tokens back from GOD holder for GovernorText


Scenario: User reset allowance
    When User setup 0 as allowance amount for token locking for text proposal


    
