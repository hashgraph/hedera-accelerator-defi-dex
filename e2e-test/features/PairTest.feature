@Pair
@TestSuite-1
Feature: Pair contract e2e test

    This feature file contains e2e test for pair contract

    Scenario: Verify token balance before and after adding liquidity
        Given User create two new tokens with name "PairToken1" and "PairToken2"
        When User define lptoken name and symbol for newly created tokens 
        When User initialize lptoken contract
        When User initialize pair contract with swap transaction fee as 1.0%      
        Then Balance of "PairToken1" and "PairToken2" in user account is 200000 and 200000 respectively   
        When User associate the LPToken with the account
        When User adds 210.00 units of PairToken1 and 230.00 units of PairToken2
        Then PairToken1 and PairToken2 balances in the pool are 210.00 units and 230.00 units respectively   
        Then Balance of "PairToken1" and "PairToken2" in user account is 199790.00 and 199770.00 respectively
    
    Scenario: Verify token balance after removing liquidity
        Given User gets the count of lptokens from  pool
        When User returns 5.00 units of lptoken
        Then User verifies 205.22233458 units of PairToken1 and 224.76731882 units of PairToken2 are left in pool
    
    Scenario: Verify swapping PairToken1 increase the PairToken1 quantity and decreases PairToken2 quantity
        Given PairToken1 and PairToken2 are present in pool
        When User swap 10 unit of token "PairToken1" with slippage as 200.0
        Then PairToken1 quantity is 212.72233458 and PairToken2 quantity is 220.75786165 in pool
        Then User verify "PairToken1" balance with treasury is 2.5
        Then User verify balance of "PairToken1" token with contract is 212.72233458
        Then User verify balance of "PairToken2" token with contract is 220.75786165
        Then Balance of "PairToken1" and "PairToken2" in user account is 199784.77766542 and 199777.90565263 respectively

    Scenario: Verify swapping PairToken2 increase the PairToken2 quantity and decreases PairToken1 quantity
        Given PairToken1 and PairToken2 are present in pool
        When User swap 10 unit of token "PairToken2" with slippage as 200.0
        Then PairToken1 quantity is 209.18886403 and PairToken2 quantity is 228.25786165 in pool
        Then User verify balance of "PairToken1" token with contract is 209.18886403
        Then User verify balance of "PairToken2" token with contract is 228.25786165
        Then Balance of "PairToken1" and "PairToken2" in user account is 199787.13331246 and 199767.90565263 respectively

    Scenario: Verify spot price for PairToken1 
        Given PairToken1 and PairToken2 are present in pool
        When User fetch spot price for "PairToken1"
        Then Expected spot price for PairToken1 should be 91645852

    Scenario: Verify PairToken1 quantity for the given PairToken2 quantity
        Given PairToken1 and PairToken2 are present in pool
        When User gives 10 units of PairToken2 to the pool
        Then Expected PairToken1 quantity should be 2.5

    Scenario: Verify slippage out value for given in PairToken2 quantity
        Given PairToken1 and PairToken2 are present in pool
        When User gives 10 units of PairToken1 for calculating slippage out
        Then Expected slippage out value should be 63375395

     Scenario: Verify slippage in value for given out PairToken2 quantity
        Given PairToken1 and PairToken2 are present in pool
        When User gives 10 units of PairToken2 for calculating slippage in
        Then Expected slippage in value should be 63303831    
      
