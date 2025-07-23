import * as vscode from 'vscode';
import * as path from 'path';
import { TestResults, Scenario, Step, FixSuggestion } from './types';

export class TestFailureTreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private testResults: TestResults | null = null;
    private suggestions: Map<string, FixSuggestion> = new Map();

    constructor() {}

    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    public updateTestResults(testResults: TestResults | null): void {
        console.log('Updating test results in tree provider:', testResults?.summary);
        this.testResults = testResults;
        this.refresh();
    }

    public addSuggestion(stepId: string, suggestion: FixSuggestion): void {
        this.suggestions.set(stepId, suggestion);
        this.refresh();
    }

    public removeSuggestion(stepId: string): void {
        this.suggestions.delete(stepId);
        this.refresh();
    }

    public getSuggestion(stepId: string): FixSuggestion | undefined {
        return this.suggestions.get(stepId);
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        console.log('getChildren called with element:', element?.label);
        
        if (!this.testResults) {
            console.log('No test results available');
            return Promise.resolve([]);
        }

        if (!element) {
            // Root level - show failed scenarios
            const failedScenarios = this.testResults.scenarios.filter(s => s.status === 'FAILED');
            console.log('Found failed scenarios:', failedScenarios.length);
            return Promise.resolve(failedScenarios.map(scenario => new ScenarioTreeItem(scenario)));
        }

        if (element instanceof ScenarioTreeItem) {
            // Show failed steps for this scenario
            const failedSteps = element.scenario.steps.filter(s => s.status === 'FAILED');
            return Promise.resolve(failedSteps.map(step => {
                const stepId = `${element.scenario.name}_step_${step.stepNumber}`;
                const hasSuggestion = this.suggestions.has(stepId);
                return new StepTreeItem(step, element.scenario, stepId, hasSuggestion);
            }));
        }

        if (element instanceof StepTreeItem) {
            // Show suggestion details if available
            const suggestion = this.suggestions.get(element.stepId);
            if (suggestion) {
                const items: TreeItem[] = [
                    new SuggestionTreeItem('Suggestion', suggestion.suggestion, 'suggestion'),
                    new SuggestionTreeItem('Reasoning', suggestion.reasoning, 'reasoning'),
                    new SuggestionTreeItem(`Confidence: ${suggestion.confidence}/10`, '', 'confidence')
                ];

                if (suggestion.codeChanges && suggestion.codeChanges.length > 0) {
                    items.push(new SuggestionTreeItem('Code Changes', '', 'codeChanges'));
                }

                if (element.step.artifacts?.screenshot) {
                    items.push(new ArtifactTreeItem('Screenshot', element.step.artifacts.screenshot, 'screenshot'));
                }

                if (element.step.artifacts?.xmlSnapshot) {
                    items.push(new ArtifactTreeItem('XML Snapshot', element.step.artifacts.xmlSnapshot, 'xml'));
                }

                return Promise.resolve(items);
            }
        }

        return Promise.resolve([]);
    }
}

export abstract class TreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
    }
}

export class ScenarioTreeItem extends TreeItem {
    constructor(public readonly scenario: Scenario) {
        super(scenario.name, vscode.TreeItemCollapsibleState.Expanded);
        this.tooltip = `${scenario.name} - Failed in ${scenario.duration}ms`;
        this.description = `${scenario.steps.filter(s => s.status === 'FAILED').length} failed steps`;
        this.iconPath = new vscode.ThemeIcon('error');
        this.contextValue = 'failedScenario';
    }
}

export class StepTreeItem extends TreeItem {
    constructor(
        public readonly step: Step,
        public readonly scenario: Scenario,
        public readonly stepId: string,
        public readonly hasSuggestion: boolean
    ) {
        super(
            `Step ${step.stepNumber}: ${step.text}`,
            hasSuggestion ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed
        );
        this.tooltip = step.error?.message || 'Failed step';
        this.description = hasSuggestion ? 'Has suggestion' : 'No suggestion';
        this.iconPath = new vscode.ThemeIcon(hasSuggestion ? 'lightbulb' : 'circle-filled');
        this.contextValue = 'failedStep';
    }
}

export class SuggestionTreeItem extends TreeItem {
    constructor(
        label: string,
        public readonly content: string,
        public readonly suggestionType: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.tooltip = content.length > 100 ? content.substring(0, 100) + '...' : content;
        this.description = content.length > 50 ? content.substring(0, 50) + '...' : content;
        this.iconPath = new vscode.ThemeIcon(
            suggestionType === 'suggestion' ? 'lightbulb' :
            suggestionType === 'reasoning' ? 'info' :
            suggestionType === 'confidence' ? 'pulse' :
            'code'
        );
        this.contextValue = 'suggestion';
    }
}

export class ArtifactTreeItem extends TreeItem {
    constructor(
        label: string,
        public readonly artifactPath: string,
        public readonly artifactType: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.tooltip = `Open ${artifactType}: ${path.basename(artifactPath)}`;
        this.description = path.basename(artifactPath);
        this.iconPath = new vscode.ThemeIcon(artifactType === 'screenshot' ? 'file-media' : 'file-code');
        this.contextValue = 'artifact';
        this.command = {
            command: artifactType === 'screenshot' ? 'test-failure-analyzer.openScreenshot' : 'test-failure-analyzer.openXmlSnapshot',
            title: `Open ${artifactType}`,
            arguments: [artifactPath]
        };
    }
}
