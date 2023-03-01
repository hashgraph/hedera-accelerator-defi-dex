@GovernorTextProposal
Feature: GovernorTextProposal e2e test

    This feature file contains e2e test for Governor text proposal

Scenario: Verify governor text proposal execution
    Given User have initialized the governor text proposal contract
    When User create a text proposal with title "sampletextproposal11" 
    When User wait for text proposal state to be "Active" for max 3 seconds
    Then User verify text proposal state is "Active"
    When User vote "For" to text proposal    
    When User wait for text proposal state to be "Succeeded" for max  seconds    
    Then User verify text proposal state is "Succeeded"
    When User fetches GOD token balance
    When User execute the text proposal with title "sampletextproposal11"
    When User wait for text proposal state to be "Executed" for max 5 seconds
    Then User verify text proposal state is "Executed"
    Then User verify GOD tokens are returned to user

Scenario: Verify user receives error message if user revote on a proposal
    When User create a text proposal with title "textproposal2" 
    When User wait for text proposal state to be "Active" for max 3 seconds
    Then User verify text proposal state is "Active"
    When User vote "For" to text proposal
    When User vote "Against" to text proposal
    Then User receives "CONTRACT_REVERT_EXECUTED" error message

Scenario: Verify governor text proposal state is not changed if user abstain from voting
    When User create a text proposal with title "textproposal3" 
    When User wait for text proposal state to be "Active" for max 3 seconds
    When User vote "Abstain" to text proposal
    Then User verify text proposal state is "Active"
    When User cancel the text proposal with title "textproposal3"

Scenario: Verify governor text proposal cannot create with blank title  
    When User create a text proposal with title ""     
    Then User receives "CONTRACT_REVERT_EXECUTED" error message
    

Scenario: Verify GOD tokens are returned on text proposal cancellation
    When User create a text proposal with title "textproposal4" 
    When User wait for text proposal state to be "Active" for max 3 seconds
    Then User verify text proposal state is "Active"
    When User fetches GOD token balance
    When User cancel the text proposal with title "textproposal4"
    Then  User verify text proposal state is "Canceled"
    Then User verify GOD tokens are returned to user

    
