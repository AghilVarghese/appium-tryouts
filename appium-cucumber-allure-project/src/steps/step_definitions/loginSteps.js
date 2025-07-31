const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');

Given('I launch the app', async function () {
  this.setCurrentStep('I launch the app');
  try {
    // App is launched automatically with session
    console.log("App launched successfully");
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});

When('I login with username {string} and password {string}', async function (username, password) {
  this.setCurrentStep(`I login with username "${username}" and password "${password}"`);
  try {
    const usernameField = await this.driver.$('~test-Username');
    await usernameField.setValue(username);
    
    const passwordField = await this.driver.$('~test-Password');
    await passwordField.setValue(password);
    
    const loginButton = await this.driver.$('~test-LOGIN');
    await loginButton.click();
    
    await this.driver.pause(3000);
  } catch (error) {
    const enhancedError = new Error(`Failed to login with ${username}: ${error.message}`);
    enhancedError.name = 'LoginError';
    this.lastStepError = enhancedError;
    throw enhancedError;
  }
});

Given('I am logged in with username {string} and password {string}', async function (username, password) {
  this.setCurrentStep(`I am logged in with username "${username}" and password "${password}"`);
  try {
    const usernameField = await this.driver.$('~test-Username');
    await usernameField.setValue(username);
    
    const passwordField = await this.driver.$('~test-Password');
    await passwordField.setValue(password);
    
    const loginButton = await this.driver.$('~test-LOGIN');
    await loginButton.click();
    
    await this.driver.pause(3000);
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});

Then('I should see the product page', async function () {
  this.setCurrentStep('I should see the product page');
  try {
    const productsTitle = await this.driver.$('~products screen');
    await productsTitle.waitForDisplayed({ timeout: 10000 });
    const isDisplayed = await productsTitle.isDisplayed();
    expect(isDisplayed).to.be.true;
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});

Then('I should see an error message {string}', async function (expectedMessage) {
  this.setCurrentStep(`I should see an error message "${expectedMessage}"`);
  try {
    const errorElement = await this.driver.$('android=new UiSelector().textContains("Username and password do not match")');
    await errorElement.waitForDisplayed({ timeout: 5000 });
    const errorText = await errorElement.getText();
    expect(errorText).to.include(expectedMessage);
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});