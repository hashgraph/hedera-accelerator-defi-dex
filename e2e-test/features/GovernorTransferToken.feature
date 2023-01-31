@GovernorTransferToken
Feature: GovernorTransferToken e2e test

    This feature file contains e2e test for governor transfer token

    Scenario: Verify user can create a proposal for transferring token
    Given user have initialized the governor transfer token contract
    When user create a new proposal with title "testtitle" description "testdescription" link "testlink" and token amount 3
    Then user verify that proposal state is 1

