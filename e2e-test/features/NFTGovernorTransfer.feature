@TestSuite-8
Feature: NFT Governor e2e test For assets transfer 

    #  HederaGovernor
    #  AssetsHolder
    #  TokenHolder
    #  asset-holder must hold the required assets before transfer
    #  receiver must associate the receiving token first before proposal execution
    #  "0.0.0" represent HBAR token as per our implementation
    #  "0.0.2726163" FT-Token for FTGovernor (default amount (proposal_creation = 1e8))
    #  "0.0.2726474" NFT-Token for NFTGovernor (default ids (creation = 1, voting = 2, transfer = 3))
    #  "0.0.2726169" FT-Token used in transfer for amount 1e8
    #  "1e8" stands for 1 with 8 zeros i.e 1_00_00_00_00

    ### -> e2e are covering below proposals
    #  HBAR transfer proposal
    #  FT token association proposal
    #  FT token transfer proposal
    #  NFT token association proposal
    #  NFT token transfer proposal

Scenario: NFTGovernor flow
    Given User creates the Governor for token-id "0.0.2726474"
    When User initializes the contracts
    Then User verify the initialization
    When User setup "2" tokens allowance for Locking
    When User lock "2" tokens in token holder for voting
    Then User verify the locked tokens in token holder

Scenario: HBAR transfer proposal
    Given User setup allowance for proposal creation with amount/id "1"
    When User create a assets transfer proposal for token "0.0.0" & amount/id "1e8"
    When User votes "For" proposal    
    Then User waits for proposal state to be "Succeeded" for max 40 seconds   
    When User transfer assets to assets-holder before execution for token "0.0.0" & amount/id "1e8" 
    When User fetch current receiver balance for token "0.0.0"
    Then User execute the proposal with fee "0"
    Then User verify transfer successfully

Scenario: FT association proposal execution
    Given User setup allowance for proposal creation with amount/id "1"
    When User create a token association proposal for token "0.0.2726169" 
    When User votes "For" proposal    
    Then User waits for proposal state to be "Succeeded" for max 40 seconds    
    Then User execute the proposal with fee "0"

Scenario: FT transfer proposal
    Given User setup allowance for proposal creation with amount/id "1"
    When User create a assets transfer proposal for token "0.0.2726169" & amount/id "1e8"
    When User votes "For" proposal    
    Then User waits for proposal state to be "Succeeded" for max 40 seconds   
    When User transfer assets to assets-holder before execution for token "0.0.2726169" & amount/id "1e8" 
    When User associate the receiving token to their account "0.0.2726169" 
    When User fetch current receiver balance for token "0.0.2726169"
    Then User execute the proposal with fee "0"
    Then User verify transfer successfully

Scenario: NFT association proposal execution
    Given User setup allowance for proposal creation with amount/id "1"
    When User create a token association proposal for token "0.0.2726474"
    When User votes "For" proposal    
    Then User waits for proposal state to be "Succeeded" for max 40 seconds    
    Then User execute the proposal with fee "0"

Scenario: NFT transfer proposal
    Given User setup allowance for proposal creation with amount/id "1"
    When User create a assets transfer proposal for token "0.0.2726474" & amount/id "3"
    When User votes "For" proposal    
    Then User waits for proposal state to be "Succeeded" for max 40 seconds   
    When User transfer assets to assets-holder before execution for token "0.0.2726474" & amount/id "3" 
    When User associate the receiving token to their account "0.0.2726474"
    When User fetch current receiver balance for token "0.0.2726474"
    Then User execute the proposal with fee "0"
    Then User verify transfer successfully
    
Scenario: Run cleanup task
    When User run cleanup task
    
