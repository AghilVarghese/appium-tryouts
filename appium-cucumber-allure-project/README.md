# Appium Cucumber Allure Project

This project is set up to perform automated testing on an Android APK using Appium, Cucumber, and Allure Reports. Below are the instructions for setting up and running the tests.

## Prerequisites

- Node.js installed on your machine.
- Appium installed globally. You can install it using npm:
  ```
  npm install -g appium
  ```
- Java Development Kit (JDK) installed.
- Android SDK installed and configured.
- An Android device or emulator set up for testing.

## Project Setup

1. Clone the repository from GitHub:
   ```
   git clone [your-github-repo-link]
   cd appium-cucumber-allure-project
   ```

2. Install the required dependencies:
   ```
   npm install
   ```

3. Place your APK file in the `apk` directory and rename it to `[your-apk-file].apk`.

## Running the Tests

To execute the tests, use the following command:
```
npx cucumber-js
```

## Generating Allure Reports

After running the tests, you can generate Allure reports by executing:
```
npx allure generate --clean
npx allure open
```

## Project Structure

- `src/steps/simpleTest.steps.js`: Contains step definitions for the Cucumber tests.
- `src/support/hooks.js`: Includes hooks for setting up and tearing down the test environment.
- `src/support/world.js`: Exports a custom world for sharing variables and functions.
- `src/features/simpleTest.feature`: Describes the simple test case in Gherkin syntax.
- `apk/[your-apk-file].apk`: The APK file to be tested.
- `package.json`: Configuration file for npm with dependencies and scripts.
- `.gitignore`: Specifies files and directories to be ignored by Git.

## Contributing

Feel free to submit issues or pull requests if you have suggestions or improvements for the project.