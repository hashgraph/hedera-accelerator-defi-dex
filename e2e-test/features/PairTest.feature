@Pair
@TestSuite-1
Feature: Pair contract e2e test

    This feature file contains e2e test for pair contract

    Scenario: Verify token balance before and after adding liquidity
        Given User create two new tokens with name "PairToken1" and "PairToken2"
        When User define lptoken name and symbol for newly created tokens 
        When User initialize lptoken contract
        When User initialize pair contract with swap transaction fee as 0.1%         
        When User adds 210 units of PairToken1 and 230 units of PairToken2
        Then PairToken1 and PairToken2 balances in the pool are 210 units and 230 units respectively   

    Scenario: Verify user can not create pair of same tokens with same fees
        When User tries to initialize the pair contract with same tokens and same fee as 0.1%
        Then User receive error message "CONTRACT_REVERT_EXECUTED"
    
    Scenario: Verify token balance after removing liquidity
        Given User gets the count of lptokens from  pool
        When User returns 5 units of lptoken
        Then User verifies 205 units of PairToken1 and 225 units of PairToken2 are left in pool
    
    Scenario: Verify swapping PairToken1 increase the PairToken1 quantity and decreases PairToken2 quantity
        Given PairToken1 and PairToken2 are present in pool
        When User swap 1 unit of token "PairToken1"
        Then PairToken1 quantity is 206 and PairToken2 quantity is 224 in pool
        Then User verify "PairToken1" balance with treasury is 0.025
        Then User verify balance of "PairToken1" token with contract is 206
        Then User verify balance of "PairToken2" token with contract is 224

    Scenario: Verify swapping PairToken2 increase the PairToken2 quantity and decreases PairToken1 quantity
        Given PairToken1 and PairToken2 are present in pool
        When User swap 1 unit of token "PairToken2"
        Then PairToken1 quantity is 205 and PairToken2 quantity is 225 in pool
        Then User verify balance of "PairToken1" token with contract is 205
        Then User verify balance of "PairToken2" token with contract is 225

    Scenario: Verify spot price for PairToken1 
        Given PairToken1 and PairToken2 are present in pool
        When User fetch spot price for "PairToken1"
        Then Expected spot price for PairToken1 should be 91370900

    Scenario: Verify PairToken1 quantity for the given PairToken2 quantity
        Given PairToken1 and PairToken2 are present in pool
        When User gives 10 units of PairToken2 to the pool
        Then Expected PairToken1 quantity should be 10

    Scenario: Verify slippage out value for given in PairToken2 quantity
        Given PairToken1 and PairToken2 are present in pool
        When User gives 10 units of PairToken1 for calculating slippage out
        Then Expected slippage out value should be 4643815

     Scenario: Verify slippage in value for given out PairToken2 quantity
        Given PairToken1 and PairToken2 are present in pool
        When User gives 10 units of PairToken2 for calculating slippage in
        Then Expected slippage in value should be 4656957    
      
