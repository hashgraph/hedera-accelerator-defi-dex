@Factory
@TestSuite-1
Feature: Factory contract e2e test

    This feature file contains e2e test for factory contract

    Scenario: Verify address of pair is same to address recieved after pair creation
        Given User have setup the factory
        When User create a new pair of tokens with name "FactoryTest1" and "FactoryTest2" and with fee as 0.1%
        Then User verify address of pair is same to address received after pair creation

    Scenario: Verify user gets error message on creating pair with more than allowed limit of fee
        When User create a pair of tokens "OutOfBoundsFactoryTest1" and "OutOfBoundsFactoryTest2" and with fee as "2e256"
        Then User receive error message "offset is out of bounds"   

    Scenario: Verify user can create pair of same tokens with different fees
        When User create a new pair with tokens "FactoryTest1" and "FactoryTest2" and with fee as 0.3%
        Then User verify address of pair is same to address received after pair creation

    Scenario: Verify user can not create pair of same tokens with same fees
        When User create pair with tokens "FactoryTest1" and "FactoryTest2" and with fee as 0.3%
        Then User verify address received is same as of already created pair address

    Scenario: Verify user can not create pair of same tokens with negative fees
        When User create a new pair with tokens "FactoryTest1" and "FactoryTest2" and with fee as -0.3%
        Then User receive error message "CONTRACT_REVERT_EXECUTED"    
    
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
        Then User gets message "CONTRACT_REVERT_EXECUTED" on creating pair with same token

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

    Scenario: Verify user gets error message on adding more than allowed max liquidity to pool
        When User set max allowance amount as "2e256" for token "Factory9" 
        When User set max allowance amount as "2e256" for token "HBAR"       
        When User tries to add "2e256" units of "Factory9" and "2e256" units of "HBAR" token  
        Then User receive error message "offset is out of bounds"  
        Then HBAR and Factory9 balances in the pool are 150.00 units and 300.00 units respectively          
        

     Scenario: Verify token balance after removing liquidity for HBAR and some other token
        Given User fetches the count of lptokens from pool
        When User sets allowance amount as 5.00 for token "lptoken" 
        When User gives 5.00 units of lptoken to pool
        Then User verifies 146.4644661 units of HBAR and 292.92893219 units of Factory9 are left in pool
        Then User verifies balance of "HBAR" token from contract is 146.4644661    
        Then User verifies balance of "Factory9" token from contract is 292.92893219

    Scenario: Verify user receive error message in case of underflow while removing liquidity
        Given Factory9 and HBAR are present in pool with quantity 292.92893219 units and 146.4644661 units respectively
        When User set max allowance amount as "2e256" for token "lptoken"
        When User tries to returns "2e256" units of lptoken to pool
        Then User receive error message "offset is out of bounds"  
        Then User verifies 146.4644661 units of HBAR and 292.92893219 units of Factory9 are left in pool
        Then User verifies balance of "HBAR" token from contract is 146.4644661    
        Then User verifies balance of "Factory9" token from contract is 292.92893219

    
    Scenario: Verify user is able to perform swap of Factory9 token with HBAR
        Given Factory9 and HBAR are present in pool with quantity 292.92893219 units and 146.4644661 units respectively
        When User update the slippage value to 200.00 
        Then HBAR token quantity is 146.4644661 and Factory9 quantity is 292.92893219 in pool  
        When User sets allowance amount as 10.00 for token "Factory9" 
        When User make swap of 10.00 unit of "Factory9" token with another token in pair with slippage as 200.00
        Then HBAR token quantity is 141.97869449 and Factory9 quantity is 302.67893219 in pool    
        Then User verifies balance of "HBAR" token from contract is 141.97869449    
        Then User verifies balance of "Factory9" token from contract is 302.67893219

    Scenario: Verify user gets error message on performing swap with more than allowed maximum quantity of token
        Given Factory9 and HBAR are present in pool with quantity 302.67893219 units and 141.97869449 units respectively
        When User set max allowance amount as "2e256" for token "Factory9" 
        When User tries to swap "2e256" unit of "Factory9" token with another token in pair with slippage as 200.00
        Then User receive error message "offset is out of bounds"  
        Then HBAR token quantity is 141.97869449 and Factory9 quantity is 302.67893219 in pool 

    
    Scenario: Verify user is able to perform swap of HBAR with Factory9 Token
        Given Factory9 and HBAR are present in pool with quantity 302.67893219 units and 141.97869449 units respectively
        When User update the slippage value to 200.00 
        When User sets allowance amount as 10.00 for token "HBAR" 
        When User make swap of 10.00 unit of "HBAR" token with another token in pair with slippage as 200.00
        Then HBAR token quantity is 151.72869449 and Factory9 quantity is 284.17095904 in pool   
        Then User verifies balance of "HBAR" token from contract is 151.72869449    
        Then User verifies balance of "Factory9" token from contract is 284.17095904 
    
    Scenario: Verify user can not create pair with same token
        Then User gets message "CONTRACT_REVERT_EXECUTED" on creating pair with two HBAR tokens
    
     Scenario: Verify Factory9 token quantity for the given HBAR quantity
        Given Factory9 and HBAR are present in pool with quantity 284.17095904 units and 151.72869449 units respectively
        When User gives 10 units of HBAR to the pool
        Then Expected quantity of Factory9 token should be 0.25
    
    Scenario: Verify user get error message while getting Factory9 token quantity for more than allowed max qty of HABR
        Given Factory9 and HBAR are present in pool with quantity 284.17095904 units and 151.72869449 units respectively
        When User tries to give "2e256" units of HBAR to the pool
        Then User receive error message "offset is out of bounds"   

    Scenario: Verify slippage out value for given in Factory9 token quantity
        Given Factory9 and HBAR are present in pool with quantity 284.17095904 units and 151.72869449 units respectively
        When User gives 10 units of Factory9 to calculate slippage out
        Then Slippage out value should be 12832697

    Scenario: Verify user get error message while calculating slippage out for more than allowed max qty of Factory9
        Given Factory9 and HBAR are present in pool with quantity 284.17095904 units and 151.72869449 units respectively
        When User gives back "2e256" units of Factory9 to calculate slippage out
        Then User receive error message "offset is out of bounds" 

    Scenario: Verify slippage in value for given out HBAR quantity
        Given Factory9 and HBAR are present in pool with quantity 284.17095904 units and 151.72869449 units respectively
        When User gives 10 units of HBAR to calculate slippage in
        Then Slippage in value should be 10371337   
    
    Scenario: Verify user get error message while calculating slippage in for more than allowed max qty of HBAR
        Given Factory9 and HBAR are present in pool with quantity 284.17095904 units and 151.72869449 units respectively
        When User give "2e256" units of HBAR to calculate slippage in
        Then User receive error message "offset is out of bounds" 

    Scenario: Verify spot price for HBAR 
        When User get spot price for "HBAR"
        Then Expected spot price should be 53393455
    
    Scenario: User reset allowance
        When User sets allowance amount as 0.00 for token "Factory9" 
        When User sets allowance amount as 0.00 for token "HBAR"    
        When User sets allowance amount as 0.00 for token "lptoken" 

    
    

   
