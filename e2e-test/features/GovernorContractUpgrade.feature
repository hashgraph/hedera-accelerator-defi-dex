@GovernorContractUpgrade
@TestSuite-2
Feature: Governor Contract Upgrade E2E Test

    This feature file contains e2e test for governor upgrade contract

    Scenario: Verify contract is upgraded on proposal execution
        Given User have initialized the governor upgrade contract
        When User get the current logic address of factory contract 
        When User deploy the contract "Factory" 
        When User create a new contract upgrade proposal with title "proposalforcontractupgrade1xy"
        When User wait for upgrade proposal state to be "Active" for max 5 seconds
        Then User verify that proposal current state is "Active"
        When User vote "For" contract upgrade proposal
        When User wait for upgrade proposal state to be "Succeeded" for max 5 seconds    
        When User execute the upgrade proposal with title "proposalforcontractupgrade1xy"
        When User wait for upgrade proposal state to be "Executed" for max 5 seconds  
        When User get the address of target contract from governor upgrade contract
        When User upgrade the contract    
        Then User verify logic address of target factory contract is different before and after upgrade

    Scenario: Verify proposal is executed even if user gives same contract to upgrade
        When User get the current logic address of factory contract 
        When User create a new contract upgrade proposal with title "proposalforcontractupgrade2xy"
        When User wait for upgrade proposal state to be "Active" for max 5 seconds
        Then User verify that proposal current state is "Active"
        When User vote "For" contract upgrade proposal
        When User wait for upgrade proposal state to be "Succeeded" for max 5 seconds    
        When User execute the upgrade proposal with title "proposalforcontractupgrade2xy"
        When User wait for upgrade proposal state to be "Executed" for max 5 seconds  
        When User get the address of target contract from governor upgrade contract
        When User upgrade the contract    
        Then User verify logic address of target contract is not changed

    Scenario: Verify contract is not upgraded if required votes are not in favour
        When User get the current logic address of factory contract 
        When User deploy the contract "Factory" 
        When User create a new contract upgrade proposal with title "proposalforcontractupgrade4w42xy"
        When User wait for upgrade proposal state to be "Active" for max 5 seconds
        Then User verify that proposal current state is "Active"
        When User vote "Against" contract upgrade proposal
        When User wait for upgrade proposal state to be "Defeated" for max 15 seconds    
        When User cancel the contract upgrade proposal with title "proposalforcontractupgrade4w42xy" 
        When User revert the god tokens for contract upgrade
        Then User verify logic address of target contract is not changed        

    Scenario: Verify contract is not upgraded if no body voted on it 
        When User get the current logic address of factory contract 
        When User deploy the contract "Factory" 
        When User create a new contract upgrade proposal with title "proposalforcontractupgrade524xwy"
        When User wait for upgrade proposal state to be "Active" for max 5 seconds
        Then User verify that proposal current state is "Active"
        When User wait for upgrade proposal state to be "Defeated" for max 15 seconds   
        When User cancel the contract upgrade proposal with title "proposalforcontractupgrade524xwy" 
        Then User verify logic address of target contract is not changed

      Scenario: Verify contract is not upgraded on proposal cancellation
        When User get the current logic address of factory contract
        When User deploy the contract "Factory" 
        When User create a new contract upgrade proposal with title "proposalforcontractupgrade2427xwy"
        When User wait for upgrade proposal state to be "Active" for max 5 seconds
        Then User verify that proposal current state is "Active"
        When User cancel the contract upgrade proposal with title "proposalforcontractupgrade2427xwy"
        Then User verify logic address of target contract is not changed
