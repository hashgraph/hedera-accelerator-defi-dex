@TestSuite-5
Feature: MultiSigDAO e2e test

    This feature file contains e2e test for MultiSigDAO functionality

# default number of DAO owners are - 2
    @MultiSigDAO
    Scenario: Verify user can not create a multisigdao with blank name 
        Given User tries to initialize the multisigdao with name as "" and logo as "https://defi-ui.hedera.com/"
        Then User receives the error message "CONTRACT_REVERT_EXECUTED"

    @MultiSigDAO
    Scenario: Verify transaction is not approved if required approval are not taken
        Given User initialize the multisigdao with name as "MultiSigDAO" and logo as "https://defi-ui.hedera.com/"
        When User propose the transaction for transferring 1 unit of the token
        Then User verify transaction state is "Pending"
        When User get 1 approval from DAO owners 
        When User verify transaction state is "Pending"

    @MultiSigDAO
    Scenario: Verify user gets error message on executing transaction for higher token amount than available in safe  
        When User propose the transaction for associating the token
        When User get 2 approval from DAO owners
        When User execute the transaction
        When User transfer 2 uint of tokens to safe
        When User fetch balance of the target token from safe
        When User propose the transaction for transferring token amount greater than safe balance of token
        When User get 2 approval from DAO owners
        When User try to execute the transaction and receives the error message "CONTRACT_REVERT_EXECUTED"

    @MultiSigDAO
    Scenario: Verify complete journey of token transfer via multisigdao
        When User propose the transaction for associating the token
        When User get 2 approval from DAO owners
        When User execute the transaction 
        When User transfer 2 uint of tokens to safe
        When User fetch balance of the target token from safe
        When User fetch balance of the target token from payee account
        When User propose the transaction for transferring 1 unit of the token
        Then User verify transaction state is "Pending"
        When User get 2 approval from DAO owners 
        When User verify transaction state is "Approved"
        When User execute the transaction
        Then User verify transaction state is "Executed"
        Then User verify that target token is transferred to the payee account

    @MultiSigDAO
    Scenario: Verify change of threshold of approvals    
        When User propose the transaction for changing the threshold of approvals to 1
        Then User verify transaction state is "Pending"
        When User get list of owners
        When User get 2 approval from DAO owners 
        When User verify transaction state is "Approved"
        When User execute the transaction
        Then User verify the updated threshold for approvals is 1

    @MultiSigDAO
    Scenario: Verify remove DAO Owner
        When User get list of owners       
        When User propose the transaction for removing 1 owner
        Then User verify transaction state is "Pending"
        When User get 2 approval from DAO owners 
        When User verify transaction state is "Approved"
        When User execute the transaction
        Then User verify number of owners are 1

    @MultiSigDAO
    Scenario: Verify add DAO Owner 
        When User get list of owners      
        When User propose the transaction for adding 1 new owner 
        Then User verify transaction state is "Pending"
        When User get 1 approval from DAO owners 
        When User verify transaction state is "Approved"        
        When User execute the transaction
        Then User verify number of owners are 2

    @MultiSigDAO
    Scenario: Verify swap DAO Owner
        When User get list of owners        
        When User propose the transaction for swapping owner
        Then User verify transaction state is "Pending"
        When User get 2 approval from DAO owners 
        When User verify transaction state is "Approved"        
        When User execute the transaction
        Then User verify new owner is swapped with old

    @MultiSigDAO
    Scenario: Get all locked token from safe
        When User fetch balance of the target token from safe
        Then User transfer balance from safe to eoa account

    @MultiSigDAOFactory
     Scenario: User intialize the multisigdao factory contract
        Given User initializes MultiSigDAOFactory Contract

    @MultiSigDAOFactory
    Scenario: Verify user can not create multisigdao with blank name via factory
        Given User tries to create the multisigdao with name as "" and logo as "https://defi-ui.hedera.com/"
        Then User receives the error message "CONTRACT_REVERT_EXECUTED"

    @MultiSigDAOFactory
    Scenario: Verify complete journey of token transfer via multisigdao via factory
        When User create MultiSigDAO with name "MultiSigDAOFactory" and logo as "" via factory
        When User propose the transaction for associating the token
        When User get 2 approval from DAO owners
        When User execute the transaction 
        When User transfer 2 uint of tokens to safe
        When User fetch balance of the target token from safe
        When User fetch balance of the target token from payee account
        When User propose the transaction for transferring 1 unit of the token
        Then User verify transaction state is "Pending"
        When User get 2 approval from DAO owners 
        When User verify transaction state is "Approved"
        When User execute the transaction
        Then User verify transaction state is "Executed"
        Then User verify that target token is transferred to the payee account

    @MultiSigDAOFactory
    Scenario: Get all locked token from safe
        When User fetch balance of the target token from safe
        Then User transfer balance from safe to eoa account

    @MultiSigDAOFactory
    Scenario: Verify multisigdao contract is upgraded via MultiSigDAOFactory
        When User deploy "MultiSigDAO" contract 
        When User upgrade the DAO logic address
        Then User verify contract logic address is updated

     @MultiSigDAOFactory
    Scenario: Verify hederagnossissafe contract is upgraded via MultiSigDAOFactory
        When User deploy "hederagnosissafe" contract 
        When User upgrade the hedera gnosis safe logic address
        Then User verify contract logic address is updated

     @MultiSigDAOFactory
    Scenario: Verify hederagnosissafeproxyfactory contract is upgraded via MultiSigDAOFactory
        When User deploy "hederagnosissafeproxyfactory" contract 
        When User upgrade the hedera gnosis safe proxy factory logic address
        Then User verify contract logic address is updated




   