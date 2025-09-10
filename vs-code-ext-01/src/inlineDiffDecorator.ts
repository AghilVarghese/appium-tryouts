import * as vscode from 'vscode';
import { CodeChange } from './types';

export class InlineDiffDecorator {
    private addedDecorationType: vscode.TextEditorDecorationType;
    private removedDecorationType: vscode.TextEditorDecorationType;

    constructor() {
        this.addedDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(76, 175, 80, 0.3)', // green
            isWholeLine: true,
        });
        this.removedDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(244, 67, 54, 0.3)', // red
            isWholeLine: true,
        });
    }

    public showDiff(editor: vscode.TextEditor, codeChange: CodeChange) {
        if (!codeChange.lineNumbers) {
            return;
        }
        const startLine = codeChange.lineNumbers.start - 1;
        const endLine = codeChange.lineNumbers.end - 1;
        // For simplicity, mark the original code as removed and suggested as added
        const removedRanges: vscode.DecorationOptions[] = [];
        const addedRanges: vscode.DecorationOptions[] = [];
        if (codeChange.originalCode) {
            removedRanges.push({
                range: new vscode.Range(startLine, 0, endLine, 0),
                hoverMessage: 'Original code',
            });
        }
        if (codeChange.suggestedCode) {
            addedRanges.push({
                range: new vscode.Range(startLine, 0, endLine, 0),
                hoverMessage: 'Suggested code',
            });
        }
        editor.setDecorations(this.removedDecorationType, removedRanges);
        editor.setDecorations(this.addedDecorationType, addedRanges);
    }

    public clear(editor: vscode.TextEditor) {
        editor.setDecorations(this.removedDecorationType, []);
        editor.setDecorations(this.addedDecorationType, []);
    }
}
