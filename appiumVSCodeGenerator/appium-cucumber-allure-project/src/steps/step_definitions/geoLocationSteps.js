const { Given, When, Then, setDefaultTimeout } = require('@cucumber/cucumber');
const { expect } = require('chai');

// Increase default timeout for all steps
setDefaultTimeout(60000); // 60 seconds

Given('the app is launched', async function () {
  this.setCurrentStep('the app is launched');
  try {
    // App is launched automatically with session
    console.log("App is launched and on login screen");
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});

When('I tap on the menu button', async function () {
  this.setCurrentStep('I tap on the menu button');
  try {
    console.log("Already on login screen, skipping menu button tap");
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});

When('I tap on the login menu item', async function () {
  this.setCurrentStep('I tap on the login menu item');
  try {
    console.log("Already on login screen, skipping login menu item tap");
  } catch (error) {
    this.lastStepError = error;
    throw error;
  }
});

When('I enter {string} in the username field', async function (username) {
  this.setCurrentStep(`I enter "${username}" in the username field`);
  try {
    const usernameField = await this.driver.$('~test-Username-field');
    await usernameField.setValue(username);
  } catch (error) {
    const enhancedError = new Error(`Failed to enter username "${username}": ${error.message}`);
    enhancedError.name = 'UsernameInputError';
    enhancedError.stack = error.stack;
    this.lastStepError = enhancedError;
    throw enhancedError;
  }
});

When('I enter {string} in the password field', async function (password) {
  this.setCurrentStep(`I enter "${password}" in the password field`);
  try {
    const passwordField = await this.driver.$('~test-Password');
    await passwordField.setValue(password);
  } catch (error) {
    const enhancedError = new Error(`Failed to enter password: ${error.message}`);
    enhancedError.name = 'PasswordInputError';
    enhancedError.stack = error.stack;
    this.lastStepError = enhancedError;
    throw enhancedError;
  }
});

When('I tap the login button', async function () {
  this.setCurrentStep('I tap the login button');
  try {
    const loginButton = await this.driver.$('~test-LOGIN');
    await loginButton.click();
    
    // Wait a moment for the login to process
    await this.driver.pause(3000);
  } catch (error) {
    const enhancedError = new Error(`Failed to tap login button: ${error.message}`);
    enhancedError.name = 'LoginButtonError';
    enhancedError.stack = error.stack;
    this.lastStepError = enhancedError;
    throw enhancedError;
  }
});

Then('I should see the products screen', async function () {
  this.setCurrentStep('I should see the products screen');
  try {
    console.log('Looking for products screen...');
    
    // Wait for products screen to appear with more specific selectors
    let productsTitle;
    let errors = [];
    
    try {
      // Try the most common accessibility ID first
      productsTitle = await this.driver.$('~products screen');
      await productsTitle.waitForDisplayed({ timeout: 10000 });
      console.log('✅ Found products screen with accessibility ID');
    } catch (firstError) {
      errors.push(`Accessibility ID '~products screen': ${firstError.message}`);
      console.log('products screen selector failed, trying alternative...');
      
      try {
        // Try looking for "Products" text
        productsTitle = await this.driver.$('android=new UiSelector().textContains("Products")');
        await productsTitle.waitForDisplayed({ timeout: 5000 });
        console.log('✅ Found products screen with Products text');
      } catch (secondError) {
        errors.push(`Text containing 'Products': ${secondError.message}`);
        console.log('Products text selector failed, trying Swag Labs header...');
        
        try {
          // Try looking for Swag Labs header
          productsTitle = await this.driver.$('android=new UiSelector().className("android.widget.TextView").textContains("Swag Labs")');
          await productsTitle.waitForDisplayed({ timeout: 5000 });
          console.log('✅ Found products screen with Swag Labs header');
        } catch (thirdError) {
          errors.push(`Header containing 'Swag Labs': ${thirdError.message}`);
          
          try {
            // Try looking for any element that might indicate we're on products page
            productsTitle = await this.driver.$('android=new UiSelector().className("android.widget.TextView").textContains("PRODUCTS")');
            await productsTitle.waitForDisplayed({ timeout: 5000 });
            console.log('✅ Found products screen with PRODUCTS text');
          } catch (fourthError) {
            errors.push(`Text containing 'PRODUCTS': ${fourthError.message}`);
            
            // If all selectors fail, create detailed error
            const detailedError = new Error(`Products screen not found after login. All attempted selectors failed:
1. ${errors[0]}
2. ${errors[1]}
3. ${errors[2]}
4. ${errors[3]}

Possible causes:
- Login failed (check credentials: standard_user/secret_sauce)
- Network connectivity issues
- App crashed or hung during login
- Products screen UI has changed
- Login is taking longer than expected (timeout issue)

Check the screenshot and XML snapshot to see the current app state.`);
            
            detailedError.name = 'ProductsScreenNotFoundError';
            this.lastStepError = detailedError;
            throw detailedError;
          }
        }
      }
    }
    
    // Verify the element is actually displayed
    const isDisplayed = await productsTitle.isDisplayed();
    if (!isDisplayed) {
      const visibilityError = new Error('Products screen element was found but is not visible on screen');
      visibilityError.name = 'ElementNotVisibleError';
      this.lastStepError = visibilityError;
      throw visibilityError;
    }
    
    console.log('✅ Products screen verification completed successfully');
    
  } catch (error) {
    console.error('❌ Products screen verification failed:', error.message);
    // Error is already stored in this.lastStepError if it was enhanced
    if (!this.lastStepError) {
      this.lastStepError = error;
    }
    throw error;
  }
});

// Add other step definitions with proper error handling...
When('I tap on the geo location menu item', async function () {
  this.setCurrentStep('I tap on the geo location menu item');
  try {
    // Add code to tap on the geo location menu item in your app
    await this.driver.$('~geoLocationMenuItem').click();
  } catch (error) {
    const enhancedError = new Error(`Failed to tap geo location menu item: ${error.message}`);
    enhancedError.name = 'GeoLocationMenuError';
    this.lastStepError = enhancedError;
    throw enhancedError;
  }
});

When('I set the geo location to longitude {float} and latitude {float}', async function (longitude, latitude) {
  this.setCurrentStep(`I set the geo location to longitude ${longitude} and latitude ${latitude}`);
  try {
    // Set geo location
    await this.driver.setGeoLocation({ longitude, latitude });
    await this.driver.pause(2000); // Give GPS more time to update
  } catch (error) {
    const enhancedError = new Error(`Failed to set geo location to ${longitude}, ${latitude}: ${error.message}`);
    enhancedError.name = 'GeoLocationSetError';
    this.lastStepError = enhancedError;
    throw enhancedError;
  }
});

Then('the app should display longitude {float} and latitude {float}', async function (expectedLongitude, expectedLatitude) {
  this.setCurrentStep(`the app should display longitude ${expectedLongitude} and latitude ${expectedLatitude}`);
  try {
    // Wait for geo location screen elements
    console.log('Waiting for longitude and latitude elements...');
    
    // You may need to adjust these selectors based on the app's actual IDs
    const longitudeElem = await this.driver.$('android=new UiSelector().textContains("Longitude")');
    const latitudeElem = await this.driver.$('android=new UiSelector().textContains("Latitude")');
    
    await longitudeElem.waitForExist({ timeout: 15000 });
    await latitudeElem.waitForExist({ timeout: 15000 });
    
    console.log('Elements found, getting text values...');
    const longitudeText = await longitudeElem.getText();
    const latitudeText = await latitudeElem.getText();
    
    // Extract numeric values from the text (assuming format like "Longitude: 52.50032")
    const longitude = parseFloat(longitudeText.split(":")[1].trim());
    const latitude = parseFloat(latitudeText.split(":")[1].trim());
    
    console.log(`Found values - longitude: ${longitude}, latitude: ${latitude}`);
    
    // Allow for minor floating point differences
    expect(longitude).to.be.closeTo(expectedLongitude, 0.00001);
    expect(latitude).to.be.closeTo(expectedLatitude, 0.00001);
  } catch (error) {
    const enhancedError = new Error(`Failed to verify geo location display: ${error.message}`);
    enhancedError.name = 'GeoLocationVerificationError';
    this.lastStepError = enhancedError;
    throw enhancedError;
  }
});