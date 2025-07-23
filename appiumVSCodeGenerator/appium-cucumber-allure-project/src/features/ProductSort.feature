Feature: Product Sorting

  Background:
    Given I am logged in with username "standard_user" and password "secret_sauce"

  Scenario: Sort products by price (low to high)
    When I sort products by "Price (low to high)"
    Then the first product should be the cheapest

  Scenario: Sort products by name (Z to A)
    When I sort products by "Name (Z to A)"
    Then the products should be sorted in reverse alphabetical order