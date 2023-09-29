@TestSuite-3
Feature: FT Governor e2e test

    #  HederaGovernor
    #  AssetsHolder
    #  TokenHolder
    #  "0.0.2726163" FT-Token for FTGovernor (default amount (proposal_creation = 1e8))
    #  "0.0.2726474" NFT-Token for NFTGovernor (default transfer id = 43)
    #  "0.0.2726169" FT-Token used in transfer for amount 1e8
    #  "1e8" stands for 1 with 8 zeros i.e 1_00_00_00_00

Scenario: FTGovernor flow
    Given User creates the Governor for token-id "0.0.2726163"
    When User initializes the contracts
    Then User verify the initialization

Scenario: Verify proposal creation should be reverted if no allowance setup before
    When User enables error flag to verify the error
    When User create a text proposal where title is "E2E-Text-Proposal" 
    Then User received the error message "CONTRACT_REVERT_EXECUTED"

Scenario: Verify proposal creation should be reverted if proposal title is blank
    When User enables error flag to verify the error
    When User create a text proposal where title is "" 
    Then User received the error message "CONTRACT_REVERT_EXECUTED"

Scenario: Verify vote casting should be reverted if no tokens locked before
    Given User setup allowance for proposal creation with amount/id "1e8"
    When User create a text proposal where title is "E2E-Text-Proposal" 
    When User enables error flag to verify the error
    When User votes "For" proposal
    Then User received the error message "CONTRACT_REVERT_EXECUTED"
    When User enables error flag to verify the error
    When User try to cancel the proposal by non-creator account
    Then User received the error message "CONTRACT_REVERT_EXECUTED"
    When User try to cancel the proposal by creator account
    Then User waits for proposal state to be "Canceled" for max 40 seconds

Scenario: Verify proposal will be in defeated state if no voting happened during voting period
    Given User setup allowance for proposal creation with amount/id "1e8"
    When User create a text proposal where title is "E2E-Text-Proposal" 
    Then User waits for proposal state to be "Defeated" for max 40 seconds
    When User try to cancel the proposal by creator account

Scenario: Verify proposal will be in defeated state if no quorum meet
    Given User setup allowance for proposal creation with amount/id "1e8"
    When User setup "10e8" tokens allowance for Locking
    When User lock "10e8" tokens in token holder for voting
    Then User verify the locked tokens in token holder
    When User create a text proposal where title is "E2E-Text-Proposal" 
    When User votes "For" proposal
    Then User waits for proposal state to be "Defeated" for max 40 seconds
    When User try to cancel the proposal by creator account

Scenario: Verify proposal will be in defeated state if vote not succeeded
    Given User setup allowance for proposal creation with amount/id "1e8"
    When User setup "20e8" tokens allowance for Locking
    When User lock "20e8" tokens in token holder for voting
    Then User verify the locked tokens in token holder
    When User create a text proposal where title is "E2E-Text-Proposal" 
    When User votes "Against" proposal
    Then User waits for proposal state to be "Defeated" for max 40 seconds
    When User try to cancel the proposal by creator account

Scenario: HBAR transfer proposal
    Given User setup allowance for proposal creation with amount/id "1e8"
    When User create a assets transfer proposal for token "0.0.0" & amount/id "1e8"
    When User votes "For" proposal    
    Then User waits for proposal state to be "Succeeded" for max 40 seconds  
    When User enables error flag to verify the error 
    Then User execute the proposal with fee "0"
    Then User received the error message "CONTRACT_REVERT_EXECUTED"
    When User try to cancel the proposal by creator account
    Then User waits for proposal state to be "Canceled" for max 40 seconds

Scenario: FT token transfer should be failed if no token exist in holder or having low balance
    Given User setup allowance for proposal creation with amount/id "1e8"
    When User create a assets transfer proposal for token "0.0.2726169" & amount/id "1e8"
    When User votes "For" proposal    
    Then User waits for proposal state to be "Succeeded" for max 40 seconds   
    When User enables error flag to verify the error
    Then User execute the proposal with fee "0"
    Then User received the error message "CONTRACT_REVERT_EXECUTED"
    When User try to cancel the proposal by creator account
    Then User waits for proposal state to be "Canceled" for max 40 seconds

Scenario: NFT token transfer should be failed if no token exist in holder or having low balance
    Given User setup allowance for proposal creation with amount/id "1e8"
    When User create a assets transfer proposal for token "0.0.2726474" & amount/id "43"
    When User votes "For" proposal    
    Then User waits for proposal state to be "Succeeded" for max 40 seconds   
    When User enables error flag to verify the error
    Then User execute the proposal with fee "0"
    Then User received the error message "CONTRACT_REVERT_EXECUTED"
    When User try to cancel the proposal by creator account
    Then User waits for proposal state to be "Canceled" for max 40 seconds

Scenario: FT / NFT token association should be failed for invalid token
    Given User setup allowance for proposal creation with amount/id "1e8"
    When User create a token association proposal for token "0.0.0" 
    When User votes "For" proposal    
    Then User waits for proposal state to be "Succeeded" for max 40 seconds  
    When User enables error flag to verify the error
    Then User execute the proposal with fee "0"
    Then User received the error message "CONTRACT_REVERT_EXECUTED"
    When User try to cancel the proposal by creator account
    Then User waits for proposal state to be "Canceled" for max 40 seconds

Scenario: FT token create proposal should be failed if no creation fee send
    Given User setup allowance for proposal creation with amount/id "1e8"
    When User create a token-create proposal with name & symbol "E2E-Test-Token" and initial value "10e8" where fee "20e8" 
    When User votes "For" proposal    
    Then User waits for proposal state to be "Succeeded" for max 40 seconds   
    When User enables error flag to verify the error
    Then User execute the proposal with fee "0"
    Then User received the error message "CONTRACT_REVERT_EXECUTED"
    When User try to cancel the proposal by creator account
    Then User waits for proposal state to be "Canceled" for max 40 seconds

Scenario: Contract's logic upgrade proposal should be failed if ownership not transferred to assets-holder before execution
    Given User setup allowance for proposal creation with amount/id "1e8"
    When User create a contract-logic upgrade proposal proxy is "0.0.2621021" and logic is "0.0.2621003"
    When User votes "For" proposal    
    Then User waits for proposal state to be "Succeeded" for max 40 seconds
    When User enables error flag to verify the error
    Then User execute the proposal with fee "0"
    Then User received the error message "CONTRACT_REVERT_EXECUTED"
    When User try to cancel the proposal by creator account
    Then User waits for proposal state to be "Canceled" for max 40 seconds

Scenario: Run cleanup task
    When User run cleanup task
    
