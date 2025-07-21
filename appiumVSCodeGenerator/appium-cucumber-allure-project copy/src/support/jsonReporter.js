const fs = require('fs');
const path = require('path');

class JSONTestReporter {
  constructor() {
    this.testResults = {
      executionInfo: {
        startTime: null,
        endTime: null,
        totalDuration: 0,
        platform: 'Android',
        device: 'Pixel 9a'
      },
      summary: {
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarios: 0,
        skippedScenarios: 0,
        totalSteps: 0,
        passedSteps: 0,
        failedSteps: 0,
        skippedSteps: 0,
        successRate: 0
      },
      scenarios: []
    };
    this.currentScenario = null;
  }

  startExecution() {
    this.testResults.executionInfo.startTime = new Date().toISOString();
  }

  startScenario(scenarioName) {
    this.currentScenario = {
      name: scenarioName,
      status: 'RUNNING',
      startTime: new Date().toISOString(),
      endTime: null,
      duration: 0,
      steps: [],
      errorSummary: null
    };
  }

  addStep(stepText, status, error = null, screenshot = null, xmlSnapshot = null) {
    const step = {
      stepNumber: (this.currentScenario?.steps.length || 0) + 1,
      text: stepText,
      status: status.toUpperCase(),
      timestamp: new Date().toISOString(),
      error: error ? {
        message: error.message || error,
        type: error.name || 'Error',
        stack: error.stack || null
      } : null,
      artifacts: {
        screenshot: screenshot,
        xmlSnapshot: xmlSnapshot
      }
    };
    
    if (this.currentScenario) {
      this.currentScenario.steps.push(step);
    }
  }

  endScenario(status, error = null) {
    if (this.currentScenario) {
      this.currentScenario.status = status.toUpperCase();
      this.currentScenario.endTime = new Date().toISOString();
      
      // Calculate duration
      const startTime = new Date(this.currentScenario.startTime);
      const endTime = new Date(this.currentScenario.endTime);
      this.currentScenario.duration = endTime - startTime;
      
      // Add error summary if scenario failed
      if (status === 'FAILED' && error) {
        this.currentScenario.errorSummary = {
          message: error.message || error,
          type: error.name || 'Error',
          failedStep: this.currentScenario.steps.find(s => s.status === 'FAILED')?.text || 'Unknown step'
        };
      }
      
      this.testResults.scenarios.push({ ...this.currentScenario });
      this.currentScenario = null;
    }
  }

  endExecution() {
    this.testResults.executionInfo.endTime = new Date().toISOString();
    
    // Calculate total duration
    const startTime = new Date(this.testResults.executionInfo.startTime);
    const endTime = new Date(this.testResults.executionInfo.endTime);
    this.testResults.executionInfo.totalDuration = endTime - startTime;
    
    // Calculate summary statistics
    this.calculateSummary();
    
    // Generate JSON report
    return this.generateJSONReport();
  }

  calculateSummary() {
    const scenarios = this.testResults.scenarios;
    
    this.testResults.summary.totalScenarios = scenarios.length;
    this.testResults.summary.passedScenarios = scenarios.filter(s => s.status === 'PASSED').length;
    this.testResults.summary.failedScenarios = scenarios.filter(s => s.status === 'FAILED').length;
    this.testResults.summary.skippedScenarios = scenarios.filter(s => s.status === 'SKIPPED').length;
    
    // Count all steps
    const allSteps = scenarios.flatMap(s => s.steps);
    this.testResults.summary.totalSteps = allSteps.length;
    this.testResults.summary.passedSteps = allSteps.filter(s => s.status === 'PASSED').length;
    this.testResults.summary.failedSteps = allSteps.filter(s => s.status === 'FAILED').length;
    this.testResults.summary.skippedSteps = allSteps.filter(s => s.status === 'SKIPPED').length;
    
    // Calculate success rate
    this.testResults.summary.successRate = this.testResults.summary.totalScenarios > 0 
      ? Math.round((this.testResults.summary.passedScenarios / this.testResults.summary.totalScenarios) * 100) 
      : 0;
  }

  generateJSONReport() {
    const reportPath = path.resolve(__dirname, '../../reports/test-results.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    
    // Write pretty-formatted JSON
    fs.writeFileSync(reportPath, JSON.stringify(this.testResults, null, 2));
    
    // Also write a minified version
    const minReportPath = path.resolve(__dirname, '../../reports/test-results.min.json');
    fs.writeFileSync(minReportPath, JSON.stringify(this.testResults));
    
    console.log(`\n📊 JSON Test Report Generated:`);
    console.log(`📄 Pretty: ${reportPath}`);
    console.log(`📦 Minified: ${minReportPath}`);
    
    // Print summary to console
    this.printSummary();
    
    return { pretty: reportPath, minified: minReportPath };
  }

  printSummary() {
    const summary = this.testResults.summary;
    console.log('\n' + '='.repeat(60));
    console.log('📈 TEST EXECUTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`📋 Total Scenarios: ${summary.totalScenarios}`);
    console.log(`✅ Passed: ${summary.passedScenarios}`);
    console.log(`❌ Failed: ${summary.failedScenarios}`);
    console.log(`⏭️  Skipped: ${summary.skippedScenarios}`);
    console.log(`📊 Success Rate: ${summary.successRate}%`);
    console.log(`🔢 Total Steps: ${summary.totalSteps} (✅${summary.passedSteps} ❌${summary.failedSteps} ⏭️${summary.skippedSteps})`);
    console.log(`⏱️  Total Duration: ${this.testResults.executionInfo.totalDuration}ms`);
    console.log('='.repeat(60));
  }
}

module.exports = { JSONTestReporter };