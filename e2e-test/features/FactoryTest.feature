@Factory
@TestSuite-1
Feature: Factory contract e2e test

    This feature file contains e2e test for factory contract

    Scenario: Verify address of pair is same to address recieved after pair creation
        Given User have setup the factory
        When User create a new pair of tokens with name "FactoryTest1" and "FactoryTest2" and with fee as 0.1%
        Then User verify address of pair is same to address received after pair creation

    Scenario: Verify user can create pair of same tokens with different fees
        When User create a new pair with tokens "FactoryTest1" and "FactoryTest2" and with fee as 0.3%
        Then User verify address of pair is same to address received after pair creation

    Scenario: Verify user can not create pair of same tokens with same fees
        When User create pair with tokens "FactoryTest1" and "FactoryTest2" and with fee as 0.3%
        Then User verify address received is same as of already created pair address

    Scenario: Verify user can not create pair of same tokens with negative fees
        When User create a new pair with tokens "FactoryTest1" and "FactoryTest2" and with fee as -0.3%
        Then User receive error message "value out-of-bounds"    
    
    Scenario: Verify pair count in pool increases by 1 after creating new pair        
        When User get all pairs of tokens
        When User create a new pair of tokens with name "FactoryTest3" and "FactoryTest4" and with fee as 0.1%
        Then User verifies count of pairs is increased by 1
    
    Scenario: Verify user can create pair with same tokens only once
        When User create a new pair of tokens with name "FactoryTest5" and "FactoryTest6" and with fee as 0.1%
        Then User verify address of pair is same to address received after pair creation        
        When User create a new pair with same tokens
        Then User verify address of pair is same to address received after pair creation

    Scenario: Verify user can create tokens with same name
        When User create tokens with same name "Factory7"
        Then User verifies their address are different

    Scenario: Verify user can not create pair with same token
        When User create a new token with name "Factory8" 
        Then User receives fails message "CONTRACT_REVERT_EXECUTED" on creating pair with same token

    Scenario: Verify Factory9 token and HBAR balance before and after adding liquidity
        When User create pair of "Factory9" and HBAR  
        When User associate LPToken with account  
        When User associate token "Factory9" to account   
        When User sets allowance amount as 300.00 for token "Factory9" 
        When User sets allowance amount as 150.00 for token "HBAR"       
        When User adds 300 units of "Factory9" and 150 units of "HBAR" token      
        Then HBAR and Factory9 balances in the pool are 150.00 units and 300.00 units respectively    
        Then User verifies balance of "HBAR" token from contract is 150.00    
        Then User verifies balance of "Factory9" token from contract is 300.00
        Then User verifies the order of addresses for created pair "HBAR" and "Factory9"     

    Scenario: Verify token balance after removing liquidity for HBAR and some other token
        Given User fetches the count of lptokens from pool
        When User sets allowance amount as 5.00 for token "lptoken" 
        When User gives 5.00 units of lptoken to pool
        Then User verifies 146.4644661 units of HBAR and 292.92893219 units of Factory9 are left in pool
        Then User verifies balance of "HBAR" token from contract is 146.4644661    
        Then User verifies balance of "Factory9" token from contract is 292.92893219
    
    Scenario: Verify user is able to perform swap of Factory9 token with HBAR
        Given Factory9 and HBAR are present in pool with quantity 292.92893219 units and 146.4644661 units respectively
        Then HBAR token quantity is 146.4644661 and Factory9 quantity is 292.92893219 in pool  
        When User sets allowance amount as 10.00 for token "Factory9" 
        When User make swap of 10.00 unit of "Factory9" token with another token in pair with slippage as 200.00
        Then HBAR token quantity is 141.97869449 and Factory9 quantity is 302.67893219 in pool    
        Then User verifies balance of "HBAR" token from contract is 141.97869449    
        Then User verifies balance of "Factory9" token from contract is 302.67893219
    
    Scenario: Verify user is able to perform swap of HBAR with Factory9 Token
        Given Factory9 and HBAR are present in pool with quantity 302.67893219 units and 141.97869449 units respectively
        When User sets allowance amount as 10.00 for token "HBAR" 
        When User make swap of 10.00 unit of "HBAR" token with another token in pair with slippage as 200.00
        Then HBAR token quantity is 151.72869449 and Factory9 quantity is 284.17095904 in pool   
        Then User verifies balance of "HBAR" token from contract is 151.72869449    
        Then User verifies balance of "Factory9" token from contract is 284.17095904 
    
    Scenario: Verify user can not create pair with same token
        Then User receives message "CONTRACT_REVERT_EXECUTED" on creating pair with two HBAR tokens
    
     Scenario: Verify Factory9 token quantity for the given HBAR quantity
        Given Factory9 and HBAR are present in pool with quantity 284.17095904 units and 151.72869449 units respectively
        When User gives 10 units of HBAR to the pool
        Then Expected quantity of Factory9 token should be 0.25

    Scenario: Verify slippage out value for given in Factory9 token quantity
        Given Factory9 and HBAR are present in pool with quantity 284.17095904 units and 151.72869449 units respectively
        When User gives 10 units of Factory9 to calculate slippage out
        Then Slippage out value should be 12832697

    Scenario: Verify slippage in value for given out HBAR quantity
        Given Factory9 and HBAR are present in pool with quantity 284.17095904 units and 151.72869449 units respectively
        When User gives 10 units of HBAR to calculate slippage in
        Then Slippage in value should be 10371337   

    Scenario: Verify spot price for HBAR 
        When User get spot price for "HBAR"
        Then Expected spot price should be 53393455

    Scenario: Verify HABR token and Factory9 balance before and after adding liquidity
        When User create pair of HBAR and "Factory9"  
        When User associate LPToken with account  
        When User associate token "Factory9" to account   
        When User sets allowance amount as 300.00 for token "Factory9" 
        When User sets allowance amount as 150.00 for token "HBAR"       
        When User adds 300 units of "Factory9" and 150 units of "HBAR" token      
        Then HBAR and Factory9 balances in the pool are 150.00 units and 300.00 units respectively    
        Then User verifies balance of "HBAR" token from contract is 150.00    
        Then User verifies balance of "Factory9" token from contract is 300.00
        Then User verifies the order of addresses for created pair "HBAR" and "Factory9"    
    
    Scenario: User reset allowance
        When User sets allowance amount as 0.00 for token "Factory9" 
        When User sets allowance amount as 0.00 for token "HBAR"    
        When User sets allowance amount as 0.00 for token "lptoken" 

    
    

   
