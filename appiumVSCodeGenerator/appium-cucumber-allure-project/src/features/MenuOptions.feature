Feature: App Menu Options

  Background:
    Given I am logged in with username "standard_user" and password "secret_sauce"

  Scenario: Open menu and logout
    When I open the app menu
    And I tap on "Logout"
    Then I should be taken to the login screen

  Scenario: Access about page
    When I open the app menu
    And I tap on "About"
    Then the browser should open the Sauce Labs website