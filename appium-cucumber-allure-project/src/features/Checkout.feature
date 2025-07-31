Feature: Checkout Process

  Background:
    Given I am logged in with username "standard_user" and password "secret_sauce"
    And I have added "Sauce Labs Backpack" to the cart

  Scenario: Complete checkout with valid info
    When I go to the cart
    And I proceed to checkout
    And I enter first name "John", last name "Doe", and zip code "12345"
    And I complete the purchase
    Then I should see the confirmation message "Thank you for your order!"

  Scenario: Checkout with missing user info
    When I go to the cart
    And I proceed to checkout
    And I leave the first name field blank
    Then I should see an error message "First Name is required"