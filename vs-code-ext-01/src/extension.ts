import * as vscode from 'vscode';
import { getOutputChannel } from './logger';
import * as fs from 'fs';
import { TestResultsParser } from './testResultsParser';
import { SuggestFixService } from './suggestFixService';
import { TestFailureTreeDataProvider, StepTreeItem } from './treeDataProvider';
import { FailureDetailsWebviewProvider } from './webviewProvider';
import { TestResults, Scenario, Step, CodeChange, FixSuggestion } from './types';
import { SuggestionCodeLensProvider } from './codeLensProvider';
import { SuggestionInlineDiffManager } from './suggestionInlineDiffManager';

export function activate(context: vscode.ExtensionContext) {
    // Show inline diff when 'Show Diff' CodeLens is clicked
    const showCodeDiffCommand = vscode.commands.registerCommand('test-failure-analyzer.showCodeDiff',
        async (uri: vscode.Uri, codeChange: CodeChange, suggestion: FixSuggestion) => {
            // Open the file and show the diff decoration
            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(doc, { preview: false });
                inlineDiffManager.showDiffForChange(codeChange);
            } catch (err) {
                vscode.window.showErrorMessage(`Could not show code diff: ${err}`);
            }
        }
    );
    // Inline diff manager for Copilot-style decorations
    const inlineDiffManager = new SuggestionInlineDiffManager();
    const outputChannel = getOutputChannel();
    outputChannel.appendLine('Test Failure Analyzer extension is now active!');

    // Initialize services
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('No workspace folder found. Please open a workspace to use Test Failure Analyzer.');
        return;
    }

    const parser = new TestResultsParser(workspaceRoot);
    const suggestFixService = new SuggestFixService();
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
    outputChannel.appendLine('Loading test results...');
        const testResults = await parser.parseTestResults();
        treeDataProvider.updateTestResults(testResults);
        updateContext(testResults);
        
        if (testResults && testResults.summary.failedScenarios > 0) {
            outputChannel.appendLine(`Found ${testResults.summary.failedScenarios} failed scenarios`);
            vscode.window.showInformationMessage(
                `Found ${testResults.summary.failedScenarios} failed scenarios with ${testResults.summary.failedSteps} failed steps.`,
                'Analyze Failures'
            ).then(selection => {
                if (selection === 'Analyze Failures') {
                    vscode.commands.executeCommand('test-failure-analyzer.analyzeFailures');
                }
            });
        } else {
            outputChannel.appendLine('No test results found or no failures');
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
                vscode.window.showInformationMessage('Getting suggestion...');
                return;
            } else {
                stepItem = item;
                stepId = stepItem.stepId;
            }

            try {
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Getting suggestion...",
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: "Analyzing failure..." });

                    // Read XML snapshot path if available
                    let xmlSnapshotPath: string | undefined;
                    if (stepItem.step.artifacts?.xmlSnapshot) {
                        xmlSnapshotPath = stepItem.step.artifacts.xmlSnapshot;
                    }

                    progress.report({ increment: 30, message: "Generating suggestion..." });

                    const suggestion = await suggestFixService.getFixSuggestion(
                        stepItem.step.text,
                        stepItem.step.error?.message || '',
                        xmlSnapshotPath || '',
                        'openai'
                    );

                    progress.report({ increment: 100, message: "Done!" });

                    if (suggestion) {
                        suggestion.stepId = stepId;
                        suggestion.scenarioName = stepItem.scenario.name;
                        treeDataProvider.addSuggestion(stepId, suggestion);
                        vscode.window.showInformationMessage(
                            `Suggestion generated.`,
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
                        vscode.window.showErrorMessage('Failed to generate suggestion.');
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
            if (!suggestion || !suggestion.codeChanges || suggestion.codeChanges.length === 0) {
                vscode.window.showErrorMessage('No suggestion or code change found for this step.');
                return;
            }
            const change = suggestion.codeChanges[0];
            const fileUri = vscode.Uri.file(`${change.filePath}`);
            try {
                const doc = await vscode.workspace.openTextDocument(fileUri);
                const editor = await vscode.window.showTextDocument(doc, { preview: false });
                if (change.lineNumbers) {
                    const pos = new vscode.Position(change.lineNumbers.start - 1, 0);
                    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
                }
                // Register CodeLens provider for this document
                const codeLensDisposable = vscode.languages.registerCodeLensProvider({ pattern: fileUri.fsPath }, new SuggestionCodeLensProvider(suggestion, change));
                context.subscriptions.push(codeLensDisposable);
                // Store disposable for later removal
                (globalThis as any)._lastCodeLensDisposable = codeLensDisposable;
                // Show Copilot-style inline diff
                inlineDiffManager.showDiffForChange(change);
                vscode.window.showInformationMessage('Use the Accept/Decline CodeLens above the changed line.');
            } catch (err) {
                vscode.window.showErrorMessage(`Could not open file for suggestion: ${err}`);
            }
        }
    );

    // Accept/Decline CodeLens commands
    const acceptCodeChangeCommand = vscode.commands.registerCommand('test-failure-analyzer.acceptCodeChange',
        async (uri: vscode.Uri, codeChange: CodeChange, suggestion: FixSuggestion) => {
            const doc = await vscode.workspace.openTextDocument(uri);
            const edit = new vscode.WorkspaceEdit();
            if (codeChange.lineNumbers) {
                const start = new vscode.Position(codeChange.lineNumbers.start - 1, 0);
                const end = new vscode.Position(codeChange.lineNumbers.end - 1, doc.lineAt(codeChange.lineNumbers.end - 1).text.length);
                edit.replace(uri, new vscode.Range(start, end), codeChange.suggestedCode);
                await vscode.workspace.applyEdit(edit);
                await doc.save();
                vscode.window.showInformationMessage('Suggestion applied!');
            }
            // Dispose CodeLens after action
            if ((globalThis as any)._lastCodeLensDisposable) {
                (globalThis as any)._lastCodeLensDisposable.dispose();
                (globalThis as any)._lastCodeLensDisposable = undefined;
            }
            // Clear inline diff
            inlineDiffManager.clear();
        }
    );
    const declineCodeChangeCommand = vscode.commands.registerCommand('test-failure-analyzer.declineCodeChange',
        async (uri: vscode.Uri, codeChange: CodeChange, suggestion: FixSuggestion) => {
            vscode.window.showInformationMessage('Suggestion declined. No changes made.');
            // Dispose CodeLens after action
            if ((globalThis as any)._lastCodeLensDisposable) {
                (globalThis as any)._lastCodeLensDisposable.dispose();
                (globalThis as any)._lastCodeLensDisposable = undefined;
            }
            // Clear inline diff
            inlineDiffManager.clear();
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
        acceptCodeChangeCommand,
        declineCodeChangeCommand,
        showCodeDiffCommand,
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
            // openaiService.refreshApiKey();
        }
    });
    context.subscriptions.push(configurationChangeHandler);

    // Load initial test results
    loadTestResults();
}

export function deactivate() {
    getOutputChannel().appendLine('Test Failure Analyzer extension is deactivated.');
}
