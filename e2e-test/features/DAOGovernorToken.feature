@DAOGovernorToken
Feature: DAOGovernorToken e2e test

    This feature file contains e2e test for DAO Governor Token

Scenario: Verify proposal is not created if user gives -ve transfer amount
    Given User initialize the DAO governor token contract with name "DAOName111" and url "DAOUrl11" and want to check exception 0
    When User create a new token transfer proposal with title "tokentransfertitle211" and token amount -10 with the help of DAO
    Then User verify that proposal is not created and user receives error message "CONTRACT_REVERT_EXECUTED"

Scenario: Verify user can create a DAO and then transfer token with help of proposal    
    Given User initialize the DAO governor token contract with name "DAOName111" and url "DAOUrl11" and want to check exception 0
    When User fetches balance of token which user wants to transfer
    When User create a new token transfer proposal with title "tokentransferproposaltitle1" and token amount 1 with the help of DAO
    When User wait for token transfer proposal state to be "Active" for maximum 15 seconds
    Then User verify token transfer proposal state is "Active"
    When User vote "For" token transfer proposal
    When User wait for token transfer proposal state to be "Succeeded" for maximum 15 seconds
    Then User verify token transfer proposal state is "Succeeded"
    When User execute token transfer proposal with title "tokentransferproposaltitle1"
    Then User verify target token is transferred to payee account 

Scenario: Verify user can create a DAO with same name 
    Given User initialize the DAO governor token contract with name "DAOName111" and url "DAOUrl11" and want to check exception 0


Scenario: Verify user cann't create a DAO with empty name 
    Given User initialize the DAO governor token contract with name "" and url "testurl" and want to check exception 1
    Then User verify user receives error message "CONTRACT_REVERT_EXECUTED" 


Scenario: Verify user cann't create a DAO with empty url 
    Given User initialize the DAO governor token contract with name "daoname" and url " and want to check exception 1
    Then User verify user receives error message "CONTRACT_REVERT_EXECUTED" 

Scenario: Verify proposal is not executed if token transfer amount is larger than token current balance
    Given User initialize the DAO governor token contract with name "DAOName111" and url "DAOUrl11"
    When User fetches balance of token which user wants to transfer
    When User create a new token transfer proposal with title "tokentransferwithhigheramt11" and token amount higher than current balance
    When User wait for token transfer proposal state to be "Active" for maximum 15 seconds
    Then User verify token transfer proposal state is "Active"
    When User vote "For" token transfer proposal
    When User wait for token transfer proposal state to be "Succeeded" for maximum 15 seconds
    Then User verify token transfer proposal state is "Succeeded"
    When User tries to execute token transfer proposal with title "tokentransferwithhigheramt11"
    Then User verify user receives error message "CONTRACT_REVERT_EXECUTED"

Scenario: Verify DAO and proposal flow with factory DAO
    Given User initialize DAO factory contract
    When User create a DAO with name "factorydao1" and url "factorydao1url"   
    When User initialize the governor token dao and governor token transfer and god holder contract via dao factory
    When User fetches balance of token which user wants to transfer 
    When User create a new token transfer proposal with title "factorytesttitle11abxz" and token amount 1 with the help of DAO
    When User wait for token transfer proposal state to be "Active" for maximum 15 seconds
    Then User verify token transfer proposal state is "Active"
    When User vote "For" token transfer proposal
    When User wait for token transfer proposal state to be "Succeeded" for maximum 15 seconds
    Then User verify token transfer proposal state is "Succeeded"
    When User execute token transfer proposal with title "factorytesttitle11abxz"
    Then User verify target token is transferred to payee account 

Scenario: Verify user can not create DAO with empty name via factory
     When User create a DAO with name "daonametest" and url ""
     Then User verify user receives error message "CONTRACT_REVERT_EXECUTED" 

Scenario: Verify user can not create DAO with empty name via factory
     When User create a DAO with name "" and url "daoUrltest"
     Then User verify user receives error message "CONTRACT_REVERT_EXECUTED" 








