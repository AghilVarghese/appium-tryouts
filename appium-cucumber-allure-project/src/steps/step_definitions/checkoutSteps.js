const { When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');

When('I go to the cart', async function () {
  this.setCurrentStep('I go to the cart');
  try {
    const cartIcon = await this.driver.$('~test-Cart');
    await cartIcon.click();
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});

When('I proceed to checkout', async function () {
  this.setCurrentStep('I proceed to checkout');
  try {
    const checkoutButton = await this.driver.$('~test-CHECKOUT');
    await checkoutButton.click();
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});

When('I enter first name {string}, last name {string}, and zip code {string}', async function (firstName, lastName, zipCode) {
  this.setCurrentStep(`I enter first name "${firstName}", last name "${lastName}", and zip code "${zipCode}"`);
  try {
    const firstNameField = await this.driver.$('~test-First Name');
    await firstNameField.setValue(firstName);
    
    const lastNameField = await this.driver.$('~test-Last Name');
    await lastNameField.setValue(lastName);
    
    const zipCodeField = await this.driver.$('~test-Zip/Postal Code');
    await zipCodeField.setValue(zipCode);
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});

When('I complete the purchase', async function () {
  this.setCurrentStep('I complete the purchase');
  try {
    const continueButton = await this.driver.$('~test-CONTINUE');
    await continueButton.click();
    
    const finishButton = await this.driver.$('~test-FINISH');
    await finishButton.click();
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});

When('I leave the first name field blank', async function () {
  this.setCurrentStep('I leave the first name field blank');
  try {
    const continueButton = await this.driver.$('~test-CONTINUE');
    await continueButton.click();
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});

Then('I should see the confirmation message {string}', async function (expectedMessage) {
  this.setCurrentStep(`I should see the confirmation message "${expectedMessage}"`);
  try {
    const confirmationMessage = await this.driver.$(`android=new UiSelector().textContains("${expectedMessage}")`);
    await confirmationMessage.waitForDisplayed({ timeout: 5000 });
    const isDisplayed = await confirmationMessage.isDisplayed();
    expect(isDisplayed).to.be.true;
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});