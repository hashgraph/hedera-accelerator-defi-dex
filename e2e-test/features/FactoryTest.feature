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