@Factory
Feature: Factory contract e2e test

    This feature file contains e2e test for factory contract

    Scenario: Verify factory setup is done 
        Given User have setup the factory
        When User create a new pair of tokens
        Then User verify address of pair of is same to address recieved after pair creation