import * as vscode from 'vscode';

// Singleton OutputChannel for the extension
let outputChannel: vscode.OutputChannel | undefined;

export function getOutputChannel(): vscode.OutputChannel {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('Test Failure Analyzer');
    }
    return outputChannel;
}
