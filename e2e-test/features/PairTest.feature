Feature: Pair contract e2e test

    This feature file contains e2e test for pair contract

    Scenario: Verify token balance before and after adding liquidity
        Given User have created pair of tokens and intialized them
        When User adds 210 units of tokenA and 230 units of tokenB
        Then User verifies tokens count in pool is correct after adding 210 units of tokenA and 230 units of tokenB
        
        
      
