Feature: Pair contract e2e test

    This feature file contains e2e test for pair contract

    Scenario: Verify token balance before and after adding liquidity
        Given User have created pair of tokens and intialized them
        When User adds 210 units of tokenA and 230 units of tokenB
        Then  tokenA and tokenB balances in the pool are 210 units and 230 units respectively   
    
    Scenario: Verify token balance after removing liquidity
        Given User gets the count of lptokens from  pool
        When User returns 5 units of lptoken
        Then User verfies 2052223346 units of tokenA and 2247673189 units of tokenB are left in pool
    
    Scenario: Verify swapping tokenA increase the tokenA quantity and decreases tokenB quantity
        Given tokenA and tokenB are present in pool
        When User swap 1 unit of tokenA
        Then increased tokenA quantity is 2061973346 and decreased tokenB quantity is 2237310811 in pool

        
      
