import * as vscode from 'vscode';
import { FixSuggestion, CodeChange } from './types';
import { InlineDiffDecorator } from './inlineDiffDecorator';

// This service manages showing inline diffs for suggestions automatically
export class SuggestionInlineDiffManager {
    private decorator: InlineDiffDecorator;
    private activeEditor: vscode.TextEditor | undefined;
    private lastCodeChange: CodeChange | undefined;

    constructor() {
        this.decorator = new InlineDiffDecorator();
        this.activeEditor = vscode.window.activeTextEditor;
        vscode.window.onDidChangeActiveTextEditor(editor => {
            this.activeEditor = editor;
            this.refresh();
        });
    }

    public showDiffForChange(codeChange: CodeChange) {
        this.lastCodeChange = codeChange;
        this.refresh();
    }

    public clear() {
        if (this.activeEditor) {
            this.decorator.clear(this.activeEditor);
        }
        this.lastCodeChange = undefined;
    }

    private refresh() {
        if (this.activeEditor && this.lastCodeChange) {
            this.decorator.showDiff(this.activeEditor, this.lastCodeChange);
        }
    }
}
