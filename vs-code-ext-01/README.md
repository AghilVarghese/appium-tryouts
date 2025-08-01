# test-f# Test Failure Analyzer

A VS Code extension that analyzes test failures in JSON reports and suggests fixes using OpenAI integration.

## Features

- **Automatic Test Results Detection**: Automatically detects and parses `test-results.json` files in your workspace
- **Failure Analysis**: Identifies failed test scenarios and steps with detailed error information
- **AI-Powered Suggestions**: Uses OpenAI to generate intelligent fix suggestions for test failures
- **Interactive Tree View**: Browse failed tests in a structured tree view in the Explorer panel
- **Detailed Failure Viewer**: View comprehensive failure details in a webview panel
- **Artifact Integration**: Quick access to screenshots and XML snapshots related to failures
- **Accept/Reject Workflow**: Review and apply or reject AI suggestions with a simple click

## Requirements

- VS Code 1.102.0 or higher
- OpenAI API key for AI suggestions
- Test results in JSON format (specifically designed for Appium test results)

## Setup

1. Install the extension
2. Configure your OpenAI API key:
   - Go to VS Code Settings
   - Search for "Test Failure Analyzer"
   - Set your OpenAI API key in `testFailureAnalyzer.openaiApiKey`
3. Configure the test results path (default: `reports/test-results.json`):
   - Set `testFailureAnalyzer.testResultsPath` to your test results file path

## Usage

### Analyzing Test Failures

1. Run your tests and generate a `test-results.json` file
2. The extension will automatically detect the file and show failed scenarios
3. Use the "Test Failures" view in the Explorer panel to browse failures
4. Click on failed steps to get more details

### Getting AI Suggestions

1. In the Test Failures tree view, click the lightbulb icon next to a failed step
2. The extension will analyze the failure and generate an AI suggestion
3. View the detailed suggestion in the webview panel
4. Accept or reject the suggestion using the provided buttons

### Commands

- `Test Failure Analyzer: Analyze Test Failures` - Manually trigger test results analysis
- `Test Failure Analyzer: Refresh` - Refresh the test failures view

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `testFailureAnalyzer.openaiApiKey` | OpenAI API key for generating suggestions | "" |
| `testFailureAnalyzer.openaiModel` | OpenAI model to use | "gpt-4" |
| `testFailureAnalyzer.testResultsPath` | Path to test results JSON file | "reports/test-results.json" |

## Expected Test Results Format

The extension expects test results in the following JSON format:

```json
{
  "executionInfo": {
    "startTime": "2025-01-20T20:28:54.080Z",
    "endTime": "2025-01-20T20:29:37.837Z",
    "totalDuration": 43757,
    "platform": "Android",
    "device": "Pixel 9a"
  },
  "summary": {
    "totalScenarios": 1,
    "passedScenarios": 0,
    "failedScenarios": 1,
    "totalSteps": 9,
    "passedSteps": 8,
    "failedSteps": 1,
    "successRate": 0
  },
  "scenarios": [
    {
      "name": "Test scenario name",
      "status": "FAILED",
      "steps": [
        {
          "stepNumber": 1,
          "text": "Step description",
          "status": "FAILED",
          "error": {
            "message": "Error message",
            "type": "Error",
            "stack": "Stack trace"
          },
          "artifacts": {
            "screenshot": "path/to/screenshot.png",
            "xmlSnapshot": "path/to/snapshot.xml"
          }
        }
      ]
    }
  ]
}
```

## AI Suggestions

The extension analyzes failures and provides:

- **Root Cause Analysis**: Understanding of what likely caused the failure
- **Fix Suggestions**: Specific code changes or improvements
- **Alternative Approaches**: Other strategies to make tests more robust
- **Confidence Rating**: AI confidence level in the suggestion (1-10)
- **Code Examples**: Practical code snippets when applicable

## Troubleshooting

### No Test Failures Shown

1. Ensure your test results file exists at the configured path
2. Check that the JSON format matches the expected structure
3. Verify the file contains failed scenarios

### AI Suggestions Not Working

1. Check your OpenAI API key configuration
2. Ensure you have sufficient OpenAI API credits
3. Try a different OpenAI model in settings

### Screenshots/XML Not Opening

1. Verify the artifact paths in your test results are correct
2. Ensure the files exist at the specified locations

## Development

To contribute or modify this extension:

```bash
# Clone and setup
npm install

# Compile
npm run compile

# Run tests
npm test

# Package
npm run package
```

## License

This extension is provided as-is for educational and development purposes.

## Release Notes

### 0.1.0

Initial release with comprehensive test failure analysis:
- Multi-error type support (element not found, timeout, assertion failures, etc.)
- AI-powered fix suggestions with OpenAI and Ollama support
- Interactive tree view for browsing test failures
- XML and screenshot artifact integration
- Intelligent error categorization and context-aware analysis

---

**Enjoy!**
