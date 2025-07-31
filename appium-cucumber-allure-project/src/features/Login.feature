Feature: User Login

  Scenario: Valid login with standard user
    Given I launch the app
    When I login with username "standard_user" and password "secret_sauce"
    Then I should see the product page

  Scenario: Invalid login with wrong credentials
    Given I launch the app
    When I login with username "wrong_user" and password "wrong_pass"
    Then I should see an error message "Username and password do not match"