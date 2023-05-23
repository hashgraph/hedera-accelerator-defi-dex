@DAONFTToken
@TestSuite-2
Feature: DAONFT Token e2e test

    This feature file contains e2e test for DAO NFT Token

Scenario: Deploy contracts 
    When User deploy the following contracts "GovernorTokenDAO,GovernorTransferToken,NFTHolder"
    When User gets the instances of deployed contracts

Scenario: Verify user cann't create a DAO with empty name 
    Given User tries to initialize the NFT DAO with name "" and url "https://defi-ui.hedera.com/"
    Then User receive the error message "CONTRACT_REVERT_EXECUTED" 

Scenario: Verify user receives error message on creating proposal without setting allowance
    Given User initialize the NFT DAO with name "NFTDAO" and url "https://defi-ui.hedera.com/"
    When User tries to create token transfer proposal with title "negativetest" and token amount as 1
    Then User receive the error message "CONTRACT_REVERT_EXECUTED" 

Scenario: Verify user can not set negative allowance
    When User setup allowance for proposal creation
    When User tries to setup allowance as -1 for token transfer
    Then User receive the error message "NEGATIVE_ALLOWANCE_AMOUNT" 

Scenario: Verify user receives error message on creating proposal with negative token amount 
    When User setup allowance for proposal creation
    When User setup allowance as 1 for token transfer
    When User tries to create token transfer proposal with title "negativetest" and token amount as -1
    Then User receive the error message "CONTRACT_REVERT_EXECUTED" 

Scenario: Verify user can create a dao and transfer the token via proposal  
    When User fetches balance of target token from account to which user wants to transfer 
    When User setup allowance for NFT Token
    When User locks NFT token with serial number 18
    When User setup allowance for proposal creation
    Then User verifies target token balance in the payer account is more than transfer amount 1
    When User setup allowance as 1 for token transfer
    When User create token transfer proposal with title "NFTDAOTokenTransferProposalTest11" and token amount as 1
    When User wait for "Active" state of token transfer proposal for maximum 25 seconds
    Then User checks token transfer proposal state is "Active"
    When User cast vote "For" proposal
    Then User wait for "Succeeded" state of token transfer proposal for maximum 25 seconds
    Then User checks token transfer proposal state is "Succeeded"
    When User executes proposal with title "NFTDAOTokenTransferProposalTest11"
    When User wait for "Executed" state of token transfer proposal for maximum 25 seconds
    Then User checks token transfer proposal state is "Executed"
    Then User confirms target token is transferred to payee account 
  

Scenario: Verify user cannot execute proposal if token transfer amount is greater than current balance in payer account
    When User fetches balance of target token from account to which user wants to transfer 
    When User setup allowance for NFT Token
    When User setup allowance for proposal creation
    Then User verifies target token balance in the payer account is more than transfer amount 1
    When User setup allowance as 1 for token transfer
    When User create token transfer proposal with title "NFTDAOTokenTransferProposalTest22" and token amount greater than current balance in payer account
    When User wait for "Active" state of token transfer proposal for maximum 25 seconds
    Then User checks token transfer proposal state is "Active"
    When User cast vote "For" proposal
    Then User wait for "Succeeded" state of token transfer proposal for maximum 25 seconds
    Then User checks token transfer proposal state is "Succeeded"
    When User tries to execute proposal with title "NFTDAOTokenTransferProposalTest22"
    Then User receive the error message "CONTRACT_REVERT_EXECUTED" 
    When User cancel the token transfer proposal with title "NFTDAOTokenTransferProposalTest22"
  

Scenario: Verify User gets back NFT tokens 
    When User claim NFT tokens


  