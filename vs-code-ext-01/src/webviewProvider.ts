import * as vscode from 'vscode';
import * as path from 'path';
import { Step, Scenario, FixSuggestion } from './types';

export class FailureDetailsWebviewProvider {
    private static currentPanel: vscode.WebviewPanel | undefined;

    public static createOrShow(
        extensionUri: vscode.Uri,
        scenario: Scenario,
        step: Step,
        suggestion?: FixSuggestion
    ): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (FailureDetailsWebviewProvider.currentPanel) {
            FailureDetailsWebviewProvider.currentPanel.reveal(column);
            FailureDetailsWebviewProvider.currentPanel.webview.html = this.getWebviewContent(
                FailureDetailsWebviewProvider.currentPanel.webview,
                extensionUri,
                scenario,
                step,
                suggestion
            );
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'failureDetails',
            `Failure Details: ${scenario.name}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media'),
                    vscode.Uri.joinPath(extensionUri, 'out')
                ]
            }
        );

        FailureDetailsWebviewProvider.currentPanel = panel;

        panel.webview.html = this.getWebviewContent(panel.webview, extensionUri, scenario, step, suggestion);

        panel.onDidDispose(() => {
            FailureDetailsWebviewProvider.currentPanel = undefined;
        });

        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'applySuggestion':
                        vscode.commands.executeCommand('test-failure-analyzer.applySuggestion', message.stepId);
                        return;
                    case 'rejectSuggestion':
                        vscode.commands.executeCommand('test-failure-analyzer.rejectSuggestion', message.stepId);
                        return;
                    case 'getSuggestion':
                        vscode.commands.executeCommand('test-failure-analyzer.getSuggestion', message.stepId);
                        return;
                    case 'openScreenshot':
                        vscode.commands.executeCommand('test-failure-analyzer.openScreenshot', message.path);
                        return;
                    case 'openXmlSnapshot':
                        vscode.commands.executeCommand('test-failure-analyzer.openXmlSnapshot', message.path);
                        return;
                }
            }
        );
    }

    public static updateContent(
        scenario: Scenario,
        step: Step,
        suggestion?: FixSuggestion
    ): void {
        if (FailureDetailsWebviewProvider.currentPanel) {
            FailureDetailsWebviewProvider.currentPanel.webview.postMessage({
                command: 'updateContent',
                scenario,
                step,
                suggestion
            });
        }
    }

    private static getWebviewContent(
        webview: vscode.Webview,
        extensionUri: vscode.Uri,
        scenario: Scenario,
        step: Step,
        suggestion?: FixSuggestion
    ): string {
        const stepId = `${scenario.name}_step_${step.stepNumber}`;
        
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Test Failure Details</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 20px;
                    line-height: 1.6;
                }
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .header {
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 20px;
                    margin-bottom: 20px;
                }
                .section {
                    margin-bottom: 30px;
                    padding: 15px;
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    background-color: var(--vscode-editor-background);
                }
                .section h3 {
                    margin-top: 0;
                    color: var(--vscode-textPreformat-foreground);
                }
                .error {
                    background-color: var(--vscode-inputValidation-errorBackground);
                    border-left: 4px solid var(--vscode-inputValidation-errorBorder);
                    padding: 10px;
                    margin: 10px 0;
                }
                .suggestion {
                    background-color: var(--vscode-textBlockQuote-background);
                    border-left: 4px solid var(--vscode-textLink-foreground);
                    padding: 15px;
                    margin: 10px 0;
                }
                .code {
                    background-color: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    padding: 10px;
                    border-radius: 4px;
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                    overflow-x: auto;
                }
                .button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    margin: 5px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .button.secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .button.secondary:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
                .artifact-link {
                    color: var(--vscode-textLink-foreground);
                    text-decoration: none;
                    margin-right: 15px;
                }
                .artifact-link:hover {
                    text-decoration: underline;
                }
                .confidence {
                    display: inline-block;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-weight: bold;
                    margin-left: 10px;
                }
                .confidence.high {
                    background-color: var(--vscode-charts-green);
                    color: white;
                }
                .confidence.medium {
                    background-color: var(--vscode-charts-yellow);
                    color: black;
                }
                .confidence.low {
                    background-color: var(--vscode-charts-red);
                    color: white;
                }
                .step-context {
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    padding: 10px;
                    border-radius: 4px;
                    margin: 10px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Test Failure Analysis</h1>
                    <h2>${scenario.name}</h2>
                    <p><strong>Duration:</strong> ${scenario.duration}ms</p>
                </div>

                <div class="section">
                    <h3>Failed Step</h3>
                    <p><strong>Step ${step.stepNumber}:</strong> ${step.text}</p>
                    <p><strong>Timestamp:</strong> ${new Date(step.timestamp).toLocaleString()}</p>
                    
                    ${step.error ? `
                    <div class="error">
                        <h4>Error Details</h4>
                        <p><strong>Type:</strong> ${step.error.type}</p>
                        <p><strong>Message:</strong> ${step.error.message}</p>
                        ${step.error.stack ? `
                        <details>
                            <summary>Stack Trace</summary>
                            <pre class="code">${step.error.stack}</pre>
                        </details>
                        ` : ''}
                    </div>
                    ` : ''}
                </div>

                <div class="section">
                    <h3>Step Context</h3>
                    <div class="step-context">
                        ${scenario.steps.map(s => `
                            <div style="margin: 5px 0; ${s.stepNumber === step.stepNumber ? 'font-weight: bold; color: var(--vscode-errorForeground);' : ''}">
                                Step ${s.stepNumber}: ${s.text} - <span style="color: ${s.status === 'PASSED' ? 'var(--vscode-charts-green)' : s.status === 'FAILED' ? 'var(--vscode-errorForeground)' : 'var(--vscode-charts-yellow)'};">${s.status}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                ${step.artifacts ? `
                <div class="section">
                    <h3>Artifacts</h3>
                    ${step.artifacts.screenshot ? `
                        <a href="#" class="artifact-link" onclick="openScreenshot('${step.artifacts.screenshot}')">📸 View Screenshot</a>
                    ` : ''}
                    ${step.artifacts.xmlSnapshot ? `
                        <a href="#" class="artifact-link" onclick="openXmlSnapshot('${step.artifacts.xmlSnapshot}')">📄 View XML Snapshot</a>
                    ` : ''}
                </div>
                ` : ''}

                <div class="section">
                    <h3>AI Suggestion</h3>
                    ${suggestion ? `
                        <div class="suggestion">
                            <h4>Suggested Fix <span class="confidence ${suggestion.confidence >= 8 ? 'high' : suggestion.confidence >= 6 ? 'medium' : 'low'}">Confidence: ${suggestion.confidence}/10</span></h4>
                            <p>${suggestion.suggestion.replace(/\\n/g, '<br>')}</p>
                            ${suggestion.reasoning ? `
                                <h4>Reasoning</h4>
                                <p>${suggestion.reasoning.replace(/\\n/g, '<br>')}</p>
                            ` : ''}
                            ${suggestion.codeChanges && suggestion.codeChanges.length > 0 ? `
                                <h4>Working Selectors from XML Analysis</h4>
                                ${suggestion.codeChanges.map(change => `
                                    <div style="margin: 15px 0; border: 1px solid var(--vscode-charts-green); border-radius: 4px; padding: 15px; background-color: var(--vscode-inputValidation-infoBackground);">
                                        <div style="margin-bottom: 10px;">
                                            <strong style="color: var(--vscode-charts-green);">✅ ${change.description}</strong>
                                        </div>
                                        <pre class="code" style="background-color: var(--vscode-editor-background); border: 1px solid var(--vscode-charts-green);">${change.suggestedCode}</pre>
                                        <div style="margin-top: 8px; font-size: 12px; color: var(--vscode-descriptionForeground);">
                                            Found in XML page source - Ready to use
                                        </div>
                                    </div>
                                `).join('')}
                            ` : ''}
                            <div style="margin-top: 15px;">
                                <button class="button" onclick="applySuggestion('${stepId}')">Apply Suggestion</button>
                                <button class="button secondary" onclick="rejectSuggestion('${stepId}')">Reject</button>
                            </div>
                        </div>
                    ` : `
                        <p>No AI suggestion available yet.</p>
                        <button class="button" onclick="getSuggestion('${stepId}')">Get AI Suggestion</button>
                    `}
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                function applySuggestion(stepId) {
                    vscode.postMessage({
                        command: 'applySuggestion',
                        stepId: stepId
                    });
                }

                function rejectSuggestion(stepId) {
                    vscode.postMessage({
                        command: 'rejectSuggestion',
                        stepId: stepId
                    });
                }

                function getSuggestion(stepId) {
                    vscode.postMessage({
                        command: 'getSuggestion',
                        stepId: stepId
                    });
                }

                function openScreenshot(path) {
                    vscode.postMessage({
                        command: 'openScreenshot',
                        path: path
                    });
                }

                function openXmlSnapshot(path) {
                    vscode.postMessage({
                        command: 'openXmlSnapshot',
                        path: path
                    });
                }

                // Listen for messages from the extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'updateContent':
                            // Reload the page with new content
                            location.reload();
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
    }
}
