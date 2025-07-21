# Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

This is a VS Code extension project. Please use the get_vscode_api with a query as input to fetch the latest VS Code API references.

## Project Context
This extension analyzes test failures in JSON reports (specifically test-results.json files) and suggests fixes using OpenAI integration. 

## Key Features
- Parse test results JSON files to identify failed scenarios
- Extract error information and context from failed steps
- Integrate with OpenAI API to suggest code fixes
- Display results in a tree view or webview panel
- Allow users to accept or decline suggested fixes
- Show screenshots and artifacts related to failures

## Technical Requirements
- Use TypeScript for type safety
- Implement tree data providers for test results visualization
- Create webview panels for detailed failure analysis
- Use VS Code's command palette for user interactions
- Handle file system operations for reading test results
- Implement OpenAI API integration for fix suggestions
