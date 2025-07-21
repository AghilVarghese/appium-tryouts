const { setWorldConstructor, BeforeStep } = require('@cucumber/cucumber');
const { remote } = require('webdriverio');
const path = require('path');
const fs = require('fs');

class CustomWorld {
  constructor() {
    this.currentStepText = 'unknown-step';
  }

  async init() {
    const apkPath = path.resolve(__dirname, '../../apk/Android.SauceLabs.Mobile.Sample.app.2.6.0.apk');
    const opts = {
      port: 4723,
      capabilities: {
        platformName: 'Android',
        'appium:deviceName': 'Pixel 9a',
        'appium:automationName': 'UiAutomator2',
        'appium:app': apkPath,
        'appium:appWaitActivity': '*'
      }
    };
    this.driver = await remote(opts);
  }
  
  setCurrentStep(text) {
    this.currentStepText = text;
    console.log(`Current step updated: ${text}`);
  }

  async takeSnapshots(prefix, stepText, status = '') {
    try {
      const sanitizedStepText = stepText.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
      const timestamp = Date.now();
      
      // Take screenshot
      const screenshot = await this.driver.takeScreenshot();
      const screenshotPath = path.resolve(
        __dirname,
        '../../screenshots',
        `${prefix}_${status}_${sanitizedStepText}_${timestamp}.png`
      );
      
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
      fs.writeFileSync(screenshotPath, screenshot, 'base64');
      
      // Take XML snapshot
      const pageSource = await this.driver.getPageSource();
      const xmlPath = path.resolve(
        __dirname,
        '../../screenshots',
        `pagesource_${prefix}_${status}_${sanitizedStepText}_${timestamp}.xml`
      );
      
      fs.writeFileSync(xmlPath, pageSource);
      
      return {
        screenshot: screenshotPath,
        xmlSnapshot: xmlPath
      };
      
    } catch (error) {
      console.error('Error taking snapshots:', error);
      return {
        screenshot: null,
        xmlSnapshot: null
      };
    }
  }
}

setWorldConstructor(CustomWorld);

// Then in your step definitions:
// filepath: /Users/LE1846/TestAutomation/appium/appiumVSCodeGenerator/appium-cucumber-allure-project/src/steps/step_definitions/geoLocationSteps.js

// When('I enter {string} in the username field', async function (username) {
//   this.currentStepText = `I enter ${username} in the username field`;
//   const usernameField = await this.driver.$('~test-Username');
//   await usernameField.setValue(username);
// });

// // And update your hooks to use this:
// // filepath: /Users/LE1846/TestAutomation/appium/appiumVSCodeGenerator/appium-cucumber-allure-project/src/support/hooks.js
// BeforeStep(async function (stepArg) {
//   try {
//     if (this.driver) {
//       // Try to get step text from pickleStep or fall back to World's currentStepText
//       let stepText = stepArg.pickleStep?.text || this.currentStepText || 'unknown-step';

//       // Rest of your code...
//     }
//   } catch (error) {
//     console.error('Error in BeforeStep:', error);
//   }
// });