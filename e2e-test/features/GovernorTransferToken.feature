@GovernorTransferToken
Feature: GovernorTransferToken e2e test

    This feature file contains e2e test for governor transfer token

    Scenario: Verify user can create a proposal for transferring token
        Given user have initialized the governor transfer token contract
        When user create a new proposal with title "testtitle" description "testdescription" link "testlink" and token amount 1
        Then user verify that proposal state is "Pending"
        When user waits for 3 seconds         
        Then user verify that proposal state is "Active"

    Scenario: Verify user can not create proposal with same title 
        When user create a new proposal with title "testtitle" description "testdescription" link "testlink" and token amount 1
        Then user gets message "CONTRACT_REVERT_EXECUTED" on creating proposal        

    Scenario: Verify user can not create proposal if user do n't have GOD tokens
        When user with no GOD token create a new proposal with title "testtitle" description "testdescription" link "testlink" and token amount 1
        Then user gets message "CONTRACT_REVERT_EXECUTED" on creating proposal

    Scenario: Verify proposal complete journey
        When user fetches token balance of the payee account
        When user create a new proposal with title "sampletitle" description "testdescription" link "testlink" and token amount 1
        When user waits for 3 seconds 
        When user vote "For" proposal
        When user waits for 5 seconds 
        Then user verify that proposal state is "Succeeded"
        When user execute the proposal with title "sampletitle"
        Then user verify that proposal state is "Executed"
        Then user verify that token is transferred to payee account

    Scenario: Verify canceling proposal changes its state to cancelled
        When user create a new proposal with title "sampletest" description "testdescription" link "testlink" and token amount 1
        When user waits for 3 seconds 
        When user cancel the proposal with title "sampletest"
        Then user verify that proposal state is "Canceled"

    Scenario: Verify proposal state is defeated if required votes are not in favour
        When user create a new proposal with title "sampletesttitle" description "testdescription" link "testlink" and token amount 1
        When user waits for 3 seconds 
        When user vote "Against" proposal
        When user waits for 5 seconds 
        Then user verify that proposal state is "Defeated"
        

    Scenario: Verify proposal state is defeated if no body voted on it
        When user create a new proposal with title "testtitlesamples" description "testdescription" link "testlink" and token amount 1
        When user waits for 3 seconds 
        When user waits for 7 seconds 
        Then user verify that proposal state is "Defeated"
    
    # Scenario: Verify GOD tokens are returned on proposal execution or cancellation    - TO DO 
 

