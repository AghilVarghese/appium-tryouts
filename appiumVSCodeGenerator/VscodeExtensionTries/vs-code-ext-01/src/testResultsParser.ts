import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TestResults, Scenario, Step } from './types';

export class TestResultsParser {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    public async parseTestResults(): Promise<TestResults | null> {
        try {
            const config = vscode.workspace.getConfiguration('testFailureAnalyzer');
            const testResultsPath = config.get<string>('testResultsPath', 'reports/test-results.json');
            const fullPath = path.join(this.workspaceRoot, testResultsPath);

            if (!fs.existsSync(fullPath)) {
                vscode.window.showWarningMessage(`Test results file not found: ${testResultsPath}`);
                return null;
            }

            const content = fs.readFileSync(fullPath, 'utf8');
            const testResults: TestResults = JSON.parse(content);

            return testResults;
        } catch (error) {
            vscode.window.showErrorMessage(`Error parsing test results: ${error}`);
            return null;
        }
    }

    public getFailedScenarios(testResults: TestResults): Scenario[] {
        return testResults.scenarios.filter(scenario => scenario.status === 'FAILED');
    }

    public getFailedSteps(scenario: Scenario): Step[] {
        return scenario.steps.filter(step => step.status === 'FAILED');
    }

    public async watchTestResults(): Promise<vscode.FileSystemWatcher | null> {
        try {
            const config = vscode.workspace.getConfiguration('testFailureAnalyzer');
            const testResultsPath = config.get<string>('testResultsPath', 'reports/test-results.json');
            const pattern = new vscode.RelativePattern(this.workspaceRoot, testResultsPath);
            
            return vscode.workspace.createFileSystemWatcher(pattern);
        } catch (error) {
            console.error('Error creating file watcher:', error);
            return null;
        }
    }

    public getArtifactPath(artifactPath: string): string {
        // Convert absolute path to relative if needed
        if (path.isAbsolute(artifactPath)) {
            return artifactPath;
        }
        return path.join(this.workspaceRoot, artifactPath);
    }

    public async openScreenshot(screenshotPath: string): Promise<void> {
        try {
            const fullPath = this.getArtifactPath(screenshotPath);
            if (fs.existsSync(fullPath)) {
                const uri = vscode.Uri.file(fullPath);
                await vscode.commands.executeCommand('vscode.open', uri);
            } else {
                vscode.window.showWarningMessage(`Screenshot not found: ${screenshotPath}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error opening screenshot: ${error}`);
        }
    }

    public async readXmlSnapshot(xmlPath: string): Promise<string | null> {
        try {
            const fullPath = this.getArtifactPath(xmlPath);
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf8');
                return content;
            } else {
                console.warn(`XML snapshot not found: ${xmlPath}`);
                return null;
            }
        } catch (error) {
            console.error('Error reading XML snapshot:', error);
            return null;
        }
    }

    public async openXmlSnapshot(xmlPath: string): Promise<void> {
        try {
            const fullPath = this.getArtifactPath(xmlPath);
            if (fs.existsSync(fullPath)) {
                const uri = vscode.Uri.file(fullPath);
                await vscode.commands.executeCommand('vscode.open', uri);
            } else {
                vscode.window.showWarningMessage(`XML snapshot not found: ${xmlPath}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error opening XML snapshot: ${error}`);
        }
    }
}
