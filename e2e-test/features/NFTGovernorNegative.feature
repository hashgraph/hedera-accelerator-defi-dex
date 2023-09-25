@NFTGovernorNegative
@TestSuite-5
Feature: Fungible Token Governor e2e test

    #  HederaGovernor
    #  AssetsHolder
    #  TokenHolder
    #  "0.0.2368573" NFT-Token for NFTGovernor (default ids (creation = 21, voting = 22))
    #  "1e8" stands for 1 with 8 zeros i.e 1_00_00_00_00

Scenario: NFTGovernor flow
    Given User creates the Governor for token-id "0.0.2368573"
    When User initialized the contracts
    Then User verify the initialization

Scenario: Verify proposal creation should be reverted if no allowance setup before
    When User create a text proposal where title is "E2E-Text-Proposal" 
    Then User received the error message "CONTRACT_REVERT_EXECUTED"

Scenario: Verify proposal creation should be reverted if proposal title is blank
    When User create a text proposal where title is "" 
    Then User received the error message "CONTRACT_REVERT_EXECUTED"

Scenario: Verify vote casting should be reverted if no tokens locked before
    Given User setup allowance for proposal creation with amount/id "21"
    When User create a text proposal where title is "E2E-Text-Proposal" 
    When User votes "For" proposal
    Then User received the error message "CONTRACT_REVERT_EXECUTED"
    When User try to cancel the proposal by non-creator account
    Then User received the error message "CONTRACT_REVERT_EXECUTED"
    When User try to cancel the proposal by creator account
    Then User waits for proposal state to be "Canceled" for max 20 seconds

Scenario: Verify proposal will be in defeated state if no voting happened during voting period
    Given User setup allowance for proposal creation with amount/id "21"
    When User create a text proposal where title is "E2E-Text-Proposal" 
    Then User waits for proposal state to be "Defeated" for max 20 seconds
    When User try to cancel the proposal by creator account

Scenario: Verify proposal will be in defeated state if vote not succeeded
    Given User setup allowance for proposal creation with amount/id "21"
    When User setup "22" tokens allowance for Locking
    When User lock "22" tokens in token holder for voting
    Then User verify the locked tokens in token holder
    When User create a text proposal where title is "E2E-Text-Proposal" 
    When User votes "Against" proposal
    Then User waits for proposal state to be "Defeated" for max 20 seconds
    When User try to cancel the proposal by creator account

Scenario: Run cleanup task
    When User run cleanup task
    
