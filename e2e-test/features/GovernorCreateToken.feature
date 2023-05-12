@GovernorCreateToken
@TestSuite-2 
Feature: GovernorCreateToken e2e test

    This feature file contains e2e test for Governor Create token

Scenario: Verify token is created on proposal execution 
    Given User have initialized the governor token create contract
    When User setup 10001 as allowance amount for token locking for token create proposal
    When User set default allowance for token create proposal
    When User create a proposal with title "proposalfortokencreate1" to create a new token with name "Token-1" and symbol "TokenSymbol-1"
    When User wait for create token proposal state to be "Active" for max 5 seconds
    Then User verify create token proposal state is "Active"
    When User lock 10001 GOD token before voting to create token proposal
    When User vote "For" create token proposal
    When User wait for create token proposal state to be "Succeeded" for max 15 seconds
    Then User verify create token proposal state is "Succeeded"
    When User execute the create token proposal with title "proposalfortokencreate1"
    When User wait for create token proposal state to be "Executed" for max 5 seconds
    Then User verify that token is created with name "Token-1" and symbol "TokenSymbol-1"


Scenario: Verify user can create pair with newly created token 
    Given User setup the factory contract
    When User create pair with token "Token-1" and "HBAR"
    Then User verify that pair exists for token "Token-1" and "HBAR"
    When User mints 10000 units of "Token-1"

Scenario: Verify user can perform swap with newly created pair
    When User associate the LPToken with account
    When User associate "Token-1" token to account
    When User transfer 500 units of Token-1 to user account
    When User sets 300.00 as allowance amount for token "Token-1" 
    When User sets 150.00 as allowance amount for token "HBAR"  
    When User gives 300 units of "Token-1" and 150 units of "HBAR" token in to the pool 
    Then User verify "Token-1" and "HBAR" balances in the pool are 300 units and 150 units respectively
    When User sets the slippage value to 200 
    When User sets 100.00 as allowance amount for token "Token-1" 
    When User swaps 100 unit of "Token-1" token with another token in pair with slippage as 200
    Then User verify "Token-1" and "HBAR" quantity in pool is 398 units and 115 units

Scenario: Verify token is not created if proposal is cancelled
    When User set default allowance for token create proposal
    When User create a proposal with title "proposalfortokencreate2" to create a new token with name "Token-2" and symbol "TokenSymbol-2"
    When User wait for create token proposal state to be "Active" for max 5 seconds
    Then User verify create token proposal state is "Active"
    When User cancel the create token proposal with title "proposalfortokencreate2"
    Then User verify that token is not created and user receives "CONTRACT_REVERT_EXECUTED" message

Scenario: Verify token is not created if required votes are not in favor
    When User set default allowance for token create proposal
    When User create a proposal with title "proposalfortokencreate3" to create a new token with name "Token-3" and symbol "TokenSymbol-3"
    When User setup 10001 as allowance amount for token locking for token create proposal
    When User wait for create token proposal state to be "Active" for max 5 seconds
    Then User verify create token proposal state is "Active"
    When User lock 10001 GOD token before voting to create token proposal
    When User vote "Against" create token proposal
    When User wait for create token proposal state to be "Defeated" for max 15 seconds
    Then User verify that token is not created and user receives "CONTRACT_REVERT_EXECUTED" message
    When User cancel the create token proposal with title "proposalfortokencreate3"

Scenario: Verify token is not created if no one voted on it
    When User set default allowance for token create proposal
    When User create a proposal with title "proposalfortokencreate4" to create a new token with name "Token-4" and symbol "TokenSymbol-4"
    When User wait for create token proposal state to be "Active" for max 5 seconds
    Then User verify create token proposal state is "Active"
    When User wait for create token proposal state to be "Defeated" for max 15 seconds
    Then User verify that token is not created and user receives "CONTRACT_REVERT_EXECUTED" message
    When User cancel the create token proposal with title "proposalfortokencreate4"

Scenario: Verify proposal is executed for creating a token with the same name as of some already existing token
    When User set default allowance for token create proposal
    When User create a proposal with title "proposalfortokencreate5" to create a new token with name "Token-4" and symbol "TokenSymbol-4"
    When User wait for create token proposal state to be "Active" for max 5 seconds
    When User setup 10001 as allowance amount for token locking for token create proposal
    Then User verify create token proposal state is "Active"
    When User lock 10001 GOD token before voting to create token proposal
    When User vote "For" create token proposal
    When User wait for create token proposal state to be "Succeeded" for max 5 seconds
    When User execute the create token proposal with title "proposalfortokencreate5"
    When User wait for create token proposal state to be "Executed" for max 5 seconds
    Then User verify that token is created with name "Token-4" and symbol "TokenSymbol-4"


Scenario: Verify user gets back locked GOD tokens
    When User fetch GOD tokens back from GOD holder