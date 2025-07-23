import * as vscode from 'vscode';
import * as fs from 'fs';
import { TestResultsParser } from './testResultsParser';
import { OpenAIService } from './openaiService';
import { TestFailureTreeDataProvider, StepTreeItem } from './treeDataProvider';
import { FailureDetailsWebviewProvider } from './webviewProvider';
import { TestResults, Scenario, Step } from './types';

export function activate(context: vscode.ExtensionContext) {
    console.log('Test Failure Analyzer extension is now active!');

    // Initialize services
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('No workspace folder found. Please open a workspace to use Test Failure Analyzer.');
        return;
    }

    const parser = new TestResultsParser(workspaceRoot);
    const openaiService = new OpenAIService();
    const treeDataProvider = new TestFailureTreeDataProvider();

    // Register tree data provider
    const treeView = vscode.window.createTreeView('testFailureAnalyzer', {
        treeDataProvider: treeDataProvider,
        showCollapseAll: true
    });

    // Track if we have failures to show/hide the view
    let hasFailures = false;

    // Function to update context and visibility
    const updateContext = (testResults: TestResults | null) => {
        const newHasFailures = testResults?.scenarios.some(s => s.status === 'FAILED') ?? false;
        if (newHasFailures !== hasFailures) {
            hasFailures = newHasFailures;
            vscode.commands.executeCommand('setContext', 'testFailureAnalyzer.hasFailures', hasFailures);
        }
    };

    // Load test results on activation
    const loadTestResults = async () => {
        console.log('Loading test results...');
        const testResults = await parser.parseTestResults();
        treeDataProvider.updateTestResults(testResults);
        updateContext(testResults);
        
        if (testResults && testResults.summary.failedScenarios > 0) {
            console.log(`Found ${testResults.summary.failedScenarios} failed scenarios`);
            vscode.window.showInformationMessage(
                `Found ${testResults.summary.failedScenarios} failed scenarios with ${testResults.summary.failedSteps} failed steps.`,
                'Analyze Failures'
            ).then(selection => {
                if (selection === 'Analyze Failures') {
                    vscode.commands.executeCommand('test-failure-analyzer.analyzeFailures');
                }
            });
        } else {
            console.log('No test results found or no failures');
        }
    };

    // Commands
    const analyzeFailuresCommand = vscode.commands.registerCommand('test-failure-analyzer.analyzeFailures', async () => {
        await loadTestResults();
        vscode.window.showInformationMessage('Test results analyzed. Check the Test Failures view in the Explorer.');
    });

    const refreshFailuresCommand = vscode.commands.registerCommand('test-failure-analyzer.refreshFailures', async () => {
        await loadTestResults();
        vscode.window.showInformationMessage('Test failures refreshed.');
    });

    const viewFailureDetailsCommand = vscode.commands.registerCommand('test-failure-analyzer.viewFailureDetails', 
        (item: StepTreeItem) => {
            const suggestion = treeDataProvider.getSuggestion(item.stepId);
            FailureDetailsWebviewProvider.createOrShow(
                context.extensionUri,
                item.scenario,
                item.step,
                suggestion
            );
        }
    );

    const getSuggestionCommand = vscode.commands.registerCommand('test-failure-analyzer.getSuggestion', 
        async (item: StepTreeItem | string) => {
            let stepItem: StepTreeItem;
            let stepId: string;

            if (typeof item === 'string') {
                // Called from webview with stepId
                stepId = item;
                // Find the step item - this is a simplified approach
                // In a real implementation, you might want to store step items differently
                vscode.window.showInformationMessage('Getting AI suggestion...');
                return;
            } else {
                stepItem = item;
                stepId = stepItem.stepId;
            }

            try {
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Getting AI suggestion...",
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: "Analyzing failure..." });

                    // Read XML snapshot if available
                    let xmlSnapshot: string | undefined;
                    if (stepItem.step.artifacts?.xmlSnapshot) {
                        try {
                            const xmlContent = await parser.readXmlSnapshot(stepItem.step.artifacts.xmlSnapshot);
                            xmlSnapshot = xmlContent || undefined;
                        } catch (error) {
                            console.error('Error reading XML snapshot:', error);
                        }
                    }

                    progress.report({ increment: 30, message: "Generating suggestion..." });

                    const suggestion = await openaiService.generateFixSuggestion(
                        stepItem.scenario,
                        stepItem.step,
                        xmlSnapshot
                    );

                    progress.report({ increment: 100, message: "Done!" });

                    if (suggestion) {
                        treeDataProvider.addSuggestion(stepId, suggestion);
                        vscode.window.showInformationMessage(
                            `AI suggestion generated with ${suggestion.confidence}/10 confidence.`,
                            'View Details'
                        ).then(selection => {
                            if (selection === 'View Details') {
                                FailureDetailsWebviewProvider.createOrShow(
                                    context.extensionUri,
                                    stepItem.scenario,
                                    stepItem.step,
                                    suggestion
                                );
                            }
                        });
                    } else {
                        vscode.window.showErrorMessage('Failed to generate AI suggestion. Please check your OpenAI configuration.');
                    }
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Error generating suggestion: ${error}`);
            }
        }
    );

    const applySuggestionCommand = vscode.commands.registerCommand('test-failure-analyzer.applySuggestion', 
        async (stepId: string) => {
            const suggestion = treeDataProvider.getSuggestion(stepId);
            if (!suggestion) {
                vscode.window.showErrorMessage('No suggestion found for this step.');
                return;
            }

            const action = await vscode.window.showInformationMessage(
                `Apply the AI suggestion for "${suggestion.scenarioName}"?`,
                { modal: true },
                'Apply',
                'Cancel'
            );

            if (action === 'Apply') {
                // Here you would implement the logic to apply the suggestion
                // This could involve modifying test files, updating selectors, etc.
                // For now, we'll show the suggestion details
                
                if (suggestion.codeChanges && suggestion.codeChanges.length > 0) {
                    // Create a new document with the suggested code
                    const doc = await vscode.workspace.openTextDocument({
                        content: suggestion.codeChanges.map(change => 
                            `// ${change.description}\n${change.suggestedCode}\n\n`
                        ).join(''),
                        language: 'javascript'
                    });
                    
                    await vscode.window.showTextDocument(doc);
                    vscode.window.showInformationMessage('Suggestion code opened in new document. Review and apply manually.');
                } else {
                    vscode.window.showInformationMessage('No specific code changes provided. Please review the suggestion manually.');
                }

                treeDataProvider.removeSuggestion(stepId);
            }
        }
    );

    const rejectSuggestionCommand = vscode.commands.registerCommand('test-failure-analyzer.rejectSuggestion', 
        async (stepId: string) => {
            const action = await vscode.window.showInformationMessage(
                'Reject this AI suggestion?',
                'Reject',
                'Cancel'
            );

            if (action === 'Reject') {
                treeDataProvider.removeSuggestion(stepId);
                vscode.window.showInformationMessage('Suggestion rejected.');
            }
        }
    );

    const openScreenshotCommand = vscode.commands.registerCommand('test-failure-analyzer.openScreenshot', 
        async (screenshotPath: string) => {
            await parser.openScreenshot(screenshotPath);
        }
    );

    const openXmlSnapshotCommand = vscode.commands.registerCommand('test-failure-analyzer.openXmlSnapshot', 
        async (xmlPath: string) => {
            await parser.openXmlSnapshot(xmlPath);
        }
    );

    // Register commands
    context.subscriptions.push(
        analyzeFailuresCommand,
        refreshFailuresCommand,
        viewFailureDetailsCommand,
        getSuggestionCommand,
        applySuggestionCommand,
        rejectSuggestionCommand,
        openScreenshotCommand,
        openXmlSnapshotCommand,
        treeView
    );

    // Watch for test results file changes
    parser.watchTestResults().then(watcher => {
        if (watcher) {
            watcher.onDidChange(() => {
                loadTestResults();
            });
            watcher.onDidCreate(() => {
                loadTestResults();
            });
            context.subscriptions.push(watcher);
        }
    });

    // Configuration change handler
    const configurationChangeHandler = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('testFailureAnalyzer.openaiApiKey')) {
            openaiService.refreshApiKey();
        }
    });
    context.subscriptions.push(configurationChangeHandler);

    // Load initial test results
    loadTestResults();
}

export function deactivate() {
    console.log('Test Failure Analyzer extension is deactivated.');
}
