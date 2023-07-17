@DAOGovernorToken
@TestSuite-4
Feature: DAOGovernorToken e2e test

    This feature file contains e2e test for DAO Governor Token

Scenario: Verify user cann't create a DAO with empty name 
    Given User tries to initialize the DAO governor token contract with name "" and url "testurl"
    Then User verify user receives error message "CONTRACT_REVERT_EXECUTED" 

Scenario: Verify user can create a DAO with same name 
    Given User initialize the DAO governor token contract with name "daoname" and url "DAOUrl11"

Scenario: Verify proposal is not created if user gives -ve transfer amount
    When User create a new token transfer proposal with title "tokentransfertitle211" and token amount -10 with the help of DAO
    Then User verify that proposal is not created and user receives error message "CONTRACT_REVERT_EXECUTED"

Scenario: Verify user can create a DAO and then transfer token with help of proposal    
    When User fetches target token balance of account to which user wants to transfer 
    Then User checks that target token balance in the payer account is more than transfer amount 1
    When User set 10001 as allowance amount for token locking for transfer token proposal via DAO
    When User set default allowance for token transfer proposal creation via DAO
    When User set 1 as allowance amount of token which needs to be transferred via DAO 
    When User create a new token transfer proposal with title "tokentransferproposaltitle1" and token amount 1 with the help of DAO    
    When User wait for token transfer proposal state to be "Active" for maximum 15 seconds
    Then User verify token transfer proposal state is "Active"
    When User lock 10001 GOD token before voting to token transfer proposal
    When User vote "For" token transfer proposal
    When User wait for token transfer proposal state to be "Succeeded" for maximum 15 seconds
    Then User verify token transfer proposal state is "Succeeded"
    When User execute token transfer proposal with title "tokentransferproposaltitle1"
    When User wait for token transfer proposal state to be "Executed" for maximum 25 seconds
    Then User verify target token is transferred to payee account 

Scenario: Verify proposal is not executed if token transfer amount is larger than token current balance
    When User set 10001 as allowance amount for token locking for transfer token proposal via DAO
    When User set default allowance for token transfer proposal creation via DAO
    When User set 1 as allowance amount of token which needs to be transferred via DAO 
    When User create a new token transfer proposal with title "tokentransferwithhigheramt11" and token amount higher than current balance
    When User wait for token transfer proposal state to be "Active" for maximum 15 seconds
    Then User verify token transfer proposal state is "Active"
    When User lock 10001 GOD token before voting to token transfer proposal
    When User vote "For" token transfer proposal
    When User wait for token transfer proposal state to be "Succeeded" for maximum 15 seconds
    Then User verify token transfer proposal state is "Succeeded"
    When User tries to execute token transfer proposal with title "tokentransferwithhigheramt11"
    Then User verify user receives error message "CONTRACT_REVERT_EXECUTED"
    When User get GOD tokens back from GOD holder

Scenario: Verify DAO and proposal flow with factory DAO
    Given User initialize DAO factory contract
    When User create a DAO with name "factorydao1" and url "factorydao1url"    
    When User initialize the governor token dao and governor token transfer and god holder contract via dao factory
    When User set 10001 as allowance amount for token locking for transfer token proposal via DAO
    When User set default allowance for token transfer proposal creation via DAO
    When User set 1 as allowance amount of token which needs to be transferred via DAO 
    When User fetches target token balance of account to which user wants to transfer 
    Then User checks that target token balance in the payer account is more than transfer amount 1
    When User create a new token transfer proposal with title "factorytesttitle11abxz" and token amount 1 with the help of DAO    
    When User wait for token transfer proposal state to be "Active" for maximum 15 seconds
    Then User verify token transfer proposal state is "Active"
    When User lock 10001 GOD token before voting to token transfer proposal
    When User vote "For" token transfer proposal
    When User wait for token transfer proposal state to be "Succeeded" for maximum 15 seconds
    Then User verify token transfer proposal state is "Succeeded"
    When User execute token transfer proposal with title "factorytesttitle11abxz"
    When User wait for token transfer proposal state to be "Executed" for maximum 25 seconds
    When User receive GOD tokens back from GOD holder created via DAO factory
    Then User verify target token is transferred to payee account 

Scenario: Verify user can not create DAO with empty name via factory
     When User create a DAO with name "" and url "daoUrltest"
     Then User verify user receives error message "CONTRACT_REVERT_EXECUTED" 

Scenario: Verify user gets back locked GOD tokens
    When User get GOD tokens back from GOD holder

Scenario: User reset allowance
    When User set 0 as allowance amount for token locking for transfer token proposal via DAO
    When  User set 0 as allowance amount of token which needs to be transferred via DAO






