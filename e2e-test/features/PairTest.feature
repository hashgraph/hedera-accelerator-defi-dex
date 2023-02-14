@Pair
Feature: Pair contract e2e test

    This feature file contains e2e test for pair contract

    Scenario: Verify token balance before and after adding liquidity
        Given User create two new tokens
        When User define lptoken name and symbol for newly created tokens 
        When User initialize lptoken contract
        When User initialize pair contract         
        When User adds 210 units of tokenA and 230 units of tokenB
        Then  tokenA and tokenB balances in the pool are 210 units and 230 units respectively   
    
    Scenario: Verify token balance after removing liquidity
        Given User gets the count of lptokens from  pool
        When User returns 5 units of lptoken
        Then User verifies 205 units of tokenA and 225 units of tokenB are left in pool
    
    Scenario: Verify swapping tokenA increase the tokenA quantity and decreases tokenB quantity
        Given tokenA and tokenB are present in pool
        When User swap 1 unit of tokenA
        Then increased tokenA quantity is 206 and decreased tokenB quantity is 224 in pool

    Scenario: Verify sport price for tokenA 
        Given tokenA and tokenB are present in pool
        When User fetch spot price for tokenA
        Then Expected spot price for tokenA should be 92161017

    Scenario: Verify tokenA quantity for the given tokenB quantity
        Given tokenA and tokenB are present in pool
        When User gives 10 units of tokenB to the pool
        Then Expected tokenA quantity should be 10

    Scenario: Verify slippage out value for given in tokenA quantity
        Given tokenA and tokenB are present in pool
        When User gives 10 units of tokenA for calculating slippage out
        Then Expected slippage out value should be 4625403

     Scenario: Verify slippage in value for given out tokenB quantity
        Given tokenA and tokenB are present in pool
        When User gives 10 units of tokenB for calculating slippage in
        Then Expected slippage in value should be 4678670    
        
      
