Feature: Geo Location

  Scenario: Set and validate the geo location
    Given the app is launched
    When I tap on the menu button
    And I tap on the login menu item
    And I enter "standard_user" in the username field
    And I enter "secret_sauce" in the password field
    And I tap the login button
    And I should see the products screen
    When I tap on the menu button
    And I tap on the geo location menu item
    And I set the geo location to longitude 52.50032 and latitude 13.45143
    Then the app should display longitude 52.50032 and latitude 13.45143