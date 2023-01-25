@Factory
Feature: Factory contract e2e test

    This feature file contains e2e test for factory contract

    Scenario: Verify address of pair of is same to address recieved after pair creation
        Given User have setup the factory
        When User create a new pair of tokens
        Then User verify address of pair is same to address received after pair creation
    
    Scenario: Verify pair count in pool increases by 1 after creating new pair        
        When User get all pairs of tokens
        When User create a new pair of tokens
        Then User verifies count of pairs is increased by 1
    
    Scenario: Verify user can create pair with same tokens only once
        When User create a new pair of tokens
        Then User verify address of pair is same to address received after pair creation        
        When User create a new pair with same tokens
        Then User verify address of pair is same to address received after pair creation

    Scenario: Verify user can create tokens with same name
        When User create tokens with same name 
        Then User verifies their address are different

    Scenario: Verify user can not create pair with same token
        When User create a new token 
        Then User gets message "CONTRACT_REVERT_EXECUTED" on creating pair with same token

     Scenario: Verify tokenA and HBAR balance before and after adding liquidity
        When User create pair of tokenA and HBAR        
        When User adds 90 units of first token and 30 units of HBAR token        
        Then first token and HBAR balances in the pool are 90 units and 30 units respectively

     Scenario: Verify token balance after removing liquidity for HBAR and some other token
        Given User fetches the count of lptokens from pool
        When User gives 1 units of lptoken to pool
        Then User verifies 88 units of tokenA and 29 units of HBAR are left in pool
    
    Scenario: Verify user is able to perform swap with HBAR and other token
        Given tokenA and HBAR are present in pool
        When User update the slippage value to 1 
        When User make swap of 1 unit of tokenA with HBAR
        Then tokenA quantity is 85 and HBAR quantity is 30 in pool
    
    Scenario: Verify user can not create pair with same token
        Then User gets message "CONTRACT_REVERT_EXECUTED" on creating pair with two HBAR tokens
    
     Scenario: Verify tokenA quantity for the given HBAR quantity
        Given tokenA and HBAR are present in pool
        When User gives 10 units of HBAR to the pool
        Then Expected quantity of tokenA should be 42

    Scenario: Verify slippage out value for given in tokenA quantity
        Given tokenA and HBAR are present in pool
        When User gives 2 units of tokenA to calculate slippage out
        Then Slippage out value should be 2290466

    Scenario: Verify slippage in value for given out HBAR quantity
        Given tokenA and HBAR are present in pool
        When User gives 10 units of HBAR to calculate slippage in
        Then Slippage in value should be 49025256    

#TO-DO - Add scenario when functionalty is available to get spot price for give
    # Scenario: Verify spot price for HBAR
    
    

   
