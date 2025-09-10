import * as vscode from 'vscode';
import { FixSuggestion, CodeChange } from './types';

export class SuggestionCodeLensProvider implements vscode.CodeLensProvider {
    private suggestion: FixSuggestion;
    private codeChange: CodeChange;

    constructor(suggestion: FixSuggestion, codeChange: CodeChange) {
        this.suggestion = suggestion;
        this.codeChange = codeChange;
    }

    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] {
        const lenses: vscode.CodeLens[] = [];
    if (!this.codeChange.lineNumbers) { return lenses; }
        const line = this.codeChange.lineNumbers.start - 1;
        const range = new vscode.Range(line, 0, line, 0);
        // Show old and new code as info CodeLens above the Accept/Decline actions
        if (this.codeChange.originalCode) {
            lenses.push(new vscode.CodeLens(range, {
                title: `Old: ${this.codeChange.originalCode.length > 60 ? this.codeChange.originalCode.slice(0, 60) + '...' : this.codeChange.originalCode}`,
                command: '',
                arguments: []
            }));
        }
        if (this.codeChange.suggestedCode) {
            lenses.push(new vscode.CodeLens(range, {
                title: `New: ${this.codeChange.suggestedCode.length > 60 ? this.codeChange.suggestedCode.slice(0, 60) + '...' : this.codeChange.suggestedCode}`,
                command: '',
                arguments: []
            }));
        }
        // Add a 'Show Diff' CodeLens to open a diff editor for the suggestion
        lenses.push(new vscode.CodeLens(range, {
            title: 'Show Diff',
            command: 'test-failure-analyzer.showCodeDiff',
            arguments: [document.uri, this.codeChange, this.suggestion]
        }));
        lenses.push(new vscode.CodeLens(range, {
            title: 'Accept Suggestion',
            command: 'test-failure-analyzer.acceptCodeChange',
            arguments: [document.uri, this.codeChange, this.suggestion]
        }));
        lenses.push(new vscode.CodeLens(range, {
            title: 'Decline Suggestion',
            command: 'test-failure-analyzer.declineCodeChange',
            arguments: [document.uri, this.codeChange, this.suggestion]
        }));
        return lenses;
    }
}
