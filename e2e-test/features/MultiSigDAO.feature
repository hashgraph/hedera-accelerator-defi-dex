@MultiSigDAO
# @TestSuite-2
Feature: MultiSigDAO e2e test

    This feature file contains e2e test for MultiSigDAO functionality

# default number of DAO owners are - 2

    Scenario: Verify user can not create a multisigdao with blank name 
        Given User tries to initialize the multisigdao with name as "" and logo as "https://defi-ui.hedera.com/"
        Then User receives the error message "CONTRACT_REVERT_EXECUTED"

    Scenario: Verify transaction is not approved if required approval are not taken
        Given User initialize the multisigdao with name as "MultiSigDAO" and logo as "https://defi-ui.hedera.com/"
        When User setup allowance amount as 1 for target token
        When User propose the transaction for transferring 1 unit of the target token
        When User fetch balance of the target token from payee account
        Then User verify transaction state is "Pending"
        When User get 1 approval from DAO owners 
        When User verify transaction state is "Pending"

    Scenario: Verify user gets error message on creating transaction for transferring token amount greater than allowance
        Given User initialize the multisigdao with name as "MultiSigDAO" and logo as "https://defi-ui.hedera.com/"
        When User setup allowance amount as 2 for target token
        When User propose transaction for transferring 3 unit of the target token
        Then User receives the error message "CONTRACT_REVERT_EXECUTED"

    Scenario: Verify user gets error message on executing transaction for higher token amount than available in payer's account
        Given User initialize the multisigdao with name as "MultiSigDAO" and logo as "https://defi-ui.hedera.com/"        
        When User fetch balance of the target token from payer account
        When User setup allowance amount greater than balance of target token in payer account
        When User propose the transaction for transferring amount greater than balance of target token in payer account
        Then User receives the error message "CONTRACT_REVERT_EXECUTED"

    Scenario: Verify complete journey of token transfer via multisigdao
        Given User initialize the multisigdao with name as "MultiSigDAO" and logo as "https://defi-ui.hedera.com/"
        When User setup allowance amount as 1 for target token
        When User propose the transaction for transferring 1 unit of the target token
        When User fetch balance of the target token from payee account
        Then User verify transaction state is "Pending"
        When User get 2 approval from DAO owners 
        When User verify transaction state is "Approved"
        When User execute the transaction
        Then User verify transaction state is "Executed"
        Then User verify that target token is transferred to the payee account

    Scenario: Change threshold of approvals 
        Given User initialize the multisigdao with name as "MultiSigDAO" and logo as "https://defi-ui.hedera.com/"        
        When User propose the transaction for changing the threshold of approvals to 1
        Then User verify transaction state is "Pending"
        When User get 2 approval from DAO owners 
        When User verify transaction state is "Approved"
        When User get the current threshold for approvals
        When User execute the transaction
        Then User verify the updated threshold for approvals is 1
    
    # Scenario: Add DAO Owner     
    # Scenario: Remove DAO Owner
    # Scenario: Swap DAO Owner



   