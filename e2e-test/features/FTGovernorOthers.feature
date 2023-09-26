@TestSuite-5
Feature: Fungible Token Governor e2e test

    #  HederaGovernor
    #  AssetsHolder
    #  TokenHolder
    #  "0.0.80158" FT-Token for FTGovernor (default amount (proposal_creation = 1e8))
    #  "1e8" stands for 1 with 8 zeros i.e 1_00_00_00_00
    #  "0.0.2621021" proxy
    #  "0.0.2621003" logic

    ### -> e2e are covering below proposals
    #  Text proposal
    #  FT token create proposal
    #  FT token mint proposal
    #  FT token burn proposal
    #  Contract's logic upgrade proposal

Scenario: FTGovernor flow
    Given User creates the Governor for token-id "0.0.80158"
    When User initialized the contracts
    Then User verify the initialization
    When User setup "20e8" tokens allowance for Locking
    When User lock "20e8" tokens in token holder for voting
    Then User verify the locked tokens in token holder
    
Scenario: Text proposal execution
    Given User setup allowance for proposal creation with amount/id "1e8"
    When User create a text proposal where title is "E2E-Text-Proposal" 
    When User votes "For" proposal    
    Then User waits for proposal state to be "Succeeded" for max 15 seconds    
    Then User execute the proposal with fee "0"
    Then User waits for proposal state to be "Executed" for max 15 seconds

Scenario: FT token create proposal
    Given User setup allowance for proposal creation with amount/id "1e8"
    When User create a token-create proposal with name & symbol "E2E-Test-Token" and initial value "10e8" where fee "20e8" 
    When User votes "For" proposal    
    Then User waits for proposal state to be "Succeeded" for max 15 seconds   
    Then User execute the proposal with fee "20e8"
    When User fetch last created token
    Then User verify token supply amount "10e8"

Scenario: FT token mint proposal
    Given User setup allowance for proposal creation with amount/id "1e8"
    When User create a token-mint proposal with value "5e8"  
    When User votes "For" proposal    
    Then User waits for proposal state to be "Succeeded" for max 15 seconds   
    Then User execute the proposal with fee "0"
    Then User verify token supply amount "15e8"

Scenario: FT token burn proposal
    Given User setup allowance for proposal creation with amount/id "1e8"
    When User create a token-burn proposal with value "2e8"  
    When User votes "For" proposal    
    Then User waits for proposal state to be "Succeeded" for max 15 seconds   
    Then User execute the proposal with fee "0"

Scenario: Contract's logic upgrade proposal
    Given User setup allowance for proposal creation with amount/id "1e8"
    When User create a contract-logic upgrade proposal proxy is "0.0.2621021" and logic is "0.0.2621003"
    When User votes "For" proposal    
    Then User waits for proposal state to be "Succeeded" for max 15 seconds
    When User transfer ownership of proxy to assets-holder
    Then User execute the proposal with fee "0"
    Then User verify proxy logic address

Scenario: Run cleanup task
    When User run cleanup task
    
