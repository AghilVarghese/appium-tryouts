const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');

When('I add {string} to the cart', async function (productName) {
  this.setCurrentStep(`I add "${productName}" to the cart`);
  try {
    const addToCartButton = await this.driver.$(`android=new UiSelector().textContains("${productName}").fromParent(new UiSelector().text("ADD TO CART"))`);
    await addToCartButton.click();
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});

When('I add {string} and {string} to the cart', async function (product1, product2) {
  this.setCurrentStep(`I add "${product1}" and "${product2}" to the cart`);
  try {
    // Add first product
    const addToCart1 = await this.driver.$(`android=new UiSelector().textContains("${product1}").fromParent(new UiSelector().text("ADD TO CART"))`);
    await addToCart1.click();
    
    await this.driver.pause(1000);
    
    // Add second product
    const addToCart2 = await this.driver.$(`android=new UiSelector().textContains("${product2}").fromParent(new UiSelector().text("ADD TO CART"))`);
    await addToCart2.click();
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});

Given('I have added {string} to the cart', async function (productName) {
  this.setCurrentStep(`I have added "${productName}" to the cart`);
  try {
    const addToCartButton = await this.driver.$(`android=new UiSelector().textContains("${productName}").fromParent(new UiSelector().text("ADD TO CART"))`);
    await addToCartButton.click();
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});

Then('the cart badge should show {string}', async function (expectedCount) {
  this.setCurrentStep(`the cart badge should show "${expectedCount}"`);
  try {
    const cartBadge = await this.driver.$('~test-Cart');
    const badgeText = await cartBadge.getText();
    expect(badgeText).to.equal(expectedCount);
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});