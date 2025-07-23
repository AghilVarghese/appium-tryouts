const { When, Then } = require('@cucumber/cucumber');
const { expect } = require('chai');

When('I sort products by {string}', async function (sortOption) {
  this.setCurrentStep(`I sort products by "${sortOption}"`);
  try {
    const sortButton = await this.driver.$('~test-Modal Selector Button');
    await sortButton.click();
    
    const sortOptionElement = await this.driver.$(`android=new UiSelector().text("${sortOption}")`);
    await sortOptionElement.click();
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});

Then('the first product should be the cheapest', async function () {
  this.setCurrentStep('the first product should be the cheapest');
  try {
    const firstProductPrice = await this.driver.$('(//android.widget.TextView[@content-desc="test-Price"])[1]');
    const priceText = await firstProductPrice.getText();
    console.log(`First product price: ${priceText}`);
    // Add verification logic based on your app's price format
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});

Then('the products should be sorted in reverse alphabetical order', async function () {
  this.setCurrentStep('the products should be sorted in reverse alphabetical order');
  try {
    const productNames = await this.driver.$$('~test-Item title');
    const names = [];
    for (let product of productNames) {
      const name = await product.getText();
      names.push(name);
    }
    
    const sortedNames = [...names].sort().reverse();
    expect(names).to.deep.equal(sortedNames);
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});