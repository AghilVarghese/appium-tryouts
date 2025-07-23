Feature: Add Items to Cart

  Background:
    Given I am logged in with username "standard_user" and password "secret_sauce"

  Scenario: Add a single item to cart
    When I add "Sauce Labs Backpack" to the cart
    Then the cart badge should show "1"

  Scenario: Add multiple items to cart
    When I add "Sauce Labs Backpack" and "Sauce Labs Bike Light" to the cart
    Then the cart badge should show "2"