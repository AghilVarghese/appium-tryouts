const { Before, After, AfterStep, BeforeStep } = require('@cucumber/cucumber');
const { JSONTestReporter } = require('./jsonReporter');
const fs = require('fs');
const path = require('path');

// Create global reporter instance
global.jsonReporter = new JSONTestReporter();
let isFirstScenario = true;

console.log('Hooks.js loaded with JSON Reporter');

// Add XML snapshot helper function
async function takeXmlSnapshot(driver, name) {
  try {
    const pageSource = await driver.getPageSource();
    const xmlPath = path.resolve(
      __dirname,
      '../../screenshots',
      `pagesource_${name}_${Date.now()}.xml`
    );
    
    fs.mkdirSync(path.dirname(xmlPath), { recursive: true });
    fs.writeFileSync(xmlPath, pageSource);
    console.log(`Page source XML saved to: ${xmlPath}`);
    return xmlPath;
  } catch (e) {
    console.error(`Failed to take XML snapshot ${name}:`, e);
  }
}

Before({ timeout: 60000 }, async function (scenario) {
  if (isFirstScenario) {
    global.jsonReporter.startExecution();
    isFirstScenario = false;
  }
  
  global.jsonReporter.startScenario(scenario.pickle.name);
  
  if (!this.driver) {
    await this.init();
  }
});

BeforeStep(async function (step) {
  try {
    if (this.driver) {
      const stepText = step.pickleStep?.text || this.currentStepText || 'unknown-step';
      this.setCurrentStep(stepText);
      
      console.log(`BeforeStep - Taking snapshots for: ${stepText}`);
      
      // Take snapshots
      await this.takeSnapshots('BEFORE', stepText);
    }
  } catch (error) {
    console.error('Error in BeforeStep:', error);
  }
});

AfterStep(async function (step) {
  try {
    if (this.driver) {
      const stepText = step.pickleStep?.text || this.currentStepText || 'unknown-step';
      const stepStatus = step.result?.status || 'unknown';
      
      // Debug what's in the step result
      console.log('Step result debug:', JSON.stringify({
        status: step.result?.status,
        hasException: !!step.result?.exception,
        hasError: !!step.result?.error,
        hasMessage: !!step.result?.message,
        exception: step.result?.exception?.message,
        error: step.result?.error?.message
      }));
      
      // Try multiple ways to get the error
      let stepError = null;
      
      if (step.result) {
        // Method 1: Direct exception
        if (step.result.exception) {
          stepError = {
            message: step.result.exception.message || step.result.exception.toString(),
            type: step.result.exception.name || step.result.exception.constructor?.name || 'Exception',
            stack: step.result.exception.stack
          };
        }
        // Method 2: Error property
        else if (step.result.error) {
          stepError = {
            message: step.result.error.message || step.result.error.toString(),
            type: step.result.error.name || 'Error',
            stack: step.result.error.stack
          };
        }
        // Method 3: Check if stored in context
        else if (this.lastStepError) {
          stepError = {
            message: this.lastStepError.message || this.lastStepError.toString(),
            type: this.lastStepError.name || this.lastStepError.constructor?.name || 'Error',
            stack: this.lastStepError.stack
          };
          this.lastStepError = null; // Clear after use
        }
        // Method 4: For failed steps without error details, try to extract from console or create generic
        else if (stepStatus === 'failed' || stepStatus === 'FAILED') {
          stepError = {
            message: `Step "${stepText}" failed. Check screenshots and XML snapshots for details.`,
            type: 'StepFailureError',
            stack: null
          };
        }
      }
      
      console.log(`AfterStep - Step: ${stepText}, Status: ${stepStatus}`);
      if (stepError) {
        console.log(`AfterStep - Error captured: ${stepError.message}`);
      }
      
      // Take snapshots
      const artifacts = await this.takeSnapshots('AFTER', stepText, stepStatus);
      
      // Add step to JSON reporter
      global.jsonReporter.addStep(
        stepText, 
        stepStatus, 
        stepError,
        artifacts.screenshot,
        artifacts.xmlSnapshot
      );
    }
  } catch (error) {
    console.error('Error in AfterStep:', error);
  }
});

After(async function (scenario) {
  try {
    const scenarioStatus = scenario.result.status;
    const scenarioError = scenario.result.exception || null;
    
    console.log(`After - Scenario: ${scenario.pickle.name}, Status: ${scenarioStatus}`);
    
    global.jsonReporter.endScenario(scenarioStatus, scenarioError);
    
  } catch (error) {
    console.error('Error in After hook:', error);
  } finally {
    if (this.driver) {
      await this.driver.deleteSession();
    }
  }
});

// Add a final hook to generate the complete report
process.on('exit', () => {
  if (global.jsonReporter) {
    global.jsonReporter.endExecution();
  }
});