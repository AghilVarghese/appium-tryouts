import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TestResults, Scenario, Step, CucumberFeature, CucumberScenario, CucumberStep } from './types';

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
            const rawData = JSON.parse(content);

            // Detect format and convert if needed
            if (Array.isArray(rawData) && rawData.length > 0 && rawData[0].keyword === 'Feature') {
                // Cucumber/WebDriverIO format
                console.log('Detected Cucumber/WebDriverIO format');
                return this.convertCucumberToTestResults(rawData as CucumberFeature[]);
            } else if (rawData.executionInfo && rawData.scenarios) {
                // Original format
                console.log('Detected original format');
                return rawData as TestResults;
            } else {
                throw new Error('Unknown test results format');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error parsing test results: ${error}`);
            return null;
        }
    }

    private convertCucumberToTestResults(features: CucumberFeature[]): TestResults {
        const scenarios: Scenario[] = [];
        
        for (const feature of features) {
            for (const element of feature.elements) {
                if (element.type === 'scenario') {
                    const convertedScenario = this.convertCucumberScenario(element, feature);
                    scenarios.push(convertedScenario);
                }
            }
        }

        // Calculate summary
        const totalScenarios = scenarios.length;
        const passedScenarios = scenarios.filter(s => s.status === 'PASSED').length;
        const failedScenarios = scenarios.filter(s => s.status === 'FAILED').length;
        const skippedScenarios = scenarios.filter(s => s.status === 'SKIPPED').length;

        const allSteps = scenarios.flatMap(s => s.steps);
        const totalSteps = allSteps.length;
        const passedSteps = allSteps.filter(s => s.status === 'PASSED').length;
        const failedSteps = allSteps.filter(s => s.status === 'FAILED').length;
        const skippedSteps = allSteps.filter(s => s.status === 'SKIPPED').length;

        const successRate = totalScenarios > 0 ? Math.round((passedScenarios / totalScenarios) * 100) : 0;

        // Get metadata from first feature
        const metadata = features[0]?.metadata;
        const platform = metadata?.platform?.name || 'Unknown';
        const device = metadata?.device || 'Unknown';

        return {
            executionInfo: {
                startTime: new Date().toISOString(), // Cucumber format doesn't have execution timing
                endTime: new Date().toISOString(),
                totalDuration: allSteps.reduce((sum, step) => sum + (step.stepNumber || 0), 0),
                platform,
                device
            },
            summary: {
                totalScenarios,
                passedScenarios,
                failedScenarios,
                skippedScenarios,
                totalSteps,
                passedSteps,
                failedSteps,
                skippedSteps,
                successRate
            },
            scenarios
        };
    }

    private convertCucumberScenario(cucumberScenario: CucumberScenario, feature: CucumberFeature): Scenario {
        const steps: Step[] = [];
        let stepNumber = 0;
        let scenarioStatus: 'PASSED' | 'FAILED' | 'SKIPPED' = 'PASSED';
        let totalDuration = 0;

        for (const cucumberStep of cucumberScenario.steps) {
            // Skip Before/After hooks from numbering but still process them
            if (cucumberStep.keyword !== 'Before' && cucumberStep.keyword !== 'After') {
                stepNumber++;
            }

            const step = this.convertCucumberStep(cucumberStep, stepNumber || 0);
            steps.push(step);

            totalDuration += cucumberStep.result.duration || 0;

            // Determine overall scenario status
            if (cucumberStep.result.status === 'failed') {
                scenarioStatus = 'FAILED';
            } else if (cucumberStep.result.status === 'skipped' && scenarioStatus !== 'FAILED') {
                scenarioStatus = 'SKIPPED';
            }
        }

        return {
            name: cucumberScenario.name,
            status: scenarioStatus,
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            duration: Math.round(totalDuration / 1000000), // Convert nanoseconds to milliseconds
            steps,
            errorSummary: scenarioStatus === 'FAILED' ? 
                steps.find(s => s.status === 'FAILED')?.error?.message : null
        };
    }

    private convertCucumberStep(cucumberStep: CucumberStep, stepNumber: number): Step {
        const status = cucumberStep.result.status.toUpperCase() as 'PASSED' | 'FAILED' | 'SKIPPED';
        
        // Create step text from keyword and name
        const stepText = cucumberStep.keyword.trim() + ' ' + cucumberStep.name;

        let error = null;
        if (cucumberStep.result.error_message) {
            // Parse error message to extract selector if present
            const selectorMatch = cucumberStep.result.error_message.match(/element \("([^"]+)"\)/);
            const selector = selectorMatch ? selectorMatch[1] : 'unknown';
            
            error = {
                message: cucumberStep.result.error_message,
                type: 'WebDriverError',
                stack: cucumberStep.result.error_message
            };
        }

        // Extract artifacts from embeddings and artifacts
        let artifacts = undefined;
        if (cucumberStep.embeddings || cucumberStep.artifacts) {
            artifacts = {
                screenshot: this.extractScreenshotPath(cucumberStep),
                xmlSnapshot: this.extractXmlPath(cucumberStep)
            };
        }

        return {
            stepNumber: stepNumber,
            text: stepText,
            status,
            timestamp: new Date().toISOString(),
            error,
            artifacts
        };
    }

    private extractScreenshotPath(cucumberStep: CucumberStep): string | undefined {
        // Check artifacts first
        if (cucumberStep.artifacts?.ScreenshotPath) {
            return cucumberStep.artifacts.ScreenshotPath;
        }
        
        // Check embeddings
        if (cucumberStep.embeddings) {
            for (const embedding of cucumberStep.embeddings) {
                if (embedding.data.includes('Screenshot:')) {
                    return embedding.data.replace('Screenshot: ', '');
                }
            }
        }
        
        return undefined;
    }

    private extractXmlPath(cucumberStep: CucumberStep): string | undefined {
        // Check artifacts first
        if (cucumberStep.artifacts?.PageSourcePath) {
            return cucumberStep.artifacts.PageSourcePath;
        }
        
        // Check embeddings
        if (cucumberStep.embeddings) {
            for (const embedding of cucumberStep.embeddings) {
                if (embedding.data.includes('Page Source:')) {
                    return embedding.data.replace('Page Source: ', '');
                }
            }
        }
        
        return undefined;
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
