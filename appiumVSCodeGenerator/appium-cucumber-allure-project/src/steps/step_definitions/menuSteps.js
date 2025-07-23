const { When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');

When('I open the app menu', async function () {
  this.setCurrentStep('I open the app menu');
  try {
    const menuButton = await this.driver.$('~test-Menu');
    await menuButton.click();
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});

When('I tap on {string}', async function (menuOption) {
  this.setCurrentStep(`I tap on "${menuOption}"`);
  try {
    const menuOptionElement = await this.driver.$(`android=new UiSelector().text("${menuOption}")`);
    await menuOptionElement.click();
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});

Then('I should be taken to the login screen', async function () {
  this.setCurrentStep('I should be taken to the login screen');
  try {
    const loginButton = await this.driver.$('~test-LOGIN');
    await loginButton.waitForDisplayed({ timeout: 5000 });
    const isDisplayed = await loginButton.isDisplayed();
    expect(isDisplayed).to.be.true;
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});

Then('the browser should open the Sauce Labs website', async function () {
  this.setCurrentStep('the browser should open the Sauce Labs website');
  try {
    // Switch to browser context or verify URL
    const contexts = await this.driver.getContexts();
    console.log('Available contexts:', contexts);
    // Add specific verification based on your app behavior
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});