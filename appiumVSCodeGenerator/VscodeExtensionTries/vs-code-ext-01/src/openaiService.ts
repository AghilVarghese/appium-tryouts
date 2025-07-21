import * as vscode from 'vscode';
import OpenAI from 'openai';
import { Step, Scenario, FixSuggestion, CodeChange } from './types';

export class OpenAIService {
    private openai: OpenAI | null = null;

    constructor() {
        this.initializeOpenAI();
    }

    private initializeOpenAI(): void {
        const config = vscode.workspace.getConfiguration('testFailureAnalyzer');
        const apiKey = config.get<string>('openaiApiKey');

        if (!apiKey) {
            vscode.window.showWarningMessage(
                'OpenAI API key not configured. Please set testFailureAnalyzer.openaiApiKey in settings.',
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'testFailureAnalyzer.openaiApiKey');
                }
            });
            return;
        }

        try {
            this.openai = new OpenAI({
                apiKey: apiKey
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Error initializing OpenAI: ${error}`);
        }
    }

    public async generateFixSuggestion(
        scenario: Scenario,
        failedStep: Step,
        xmlSnapshot?: string
    ): Promise<FixSuggestion | null> {
        if (!this.openai) {
            this.initializeOpenAI();
            if (!this.openai) {
                return null;
            }
        }

        try {
            const config = vscode.workspace.getConfiguration('testFailureAnalyzer');
            const model = config.get<string>('openaiModel', 'gpt-4');

            const prompt = this.buildPrompt(scenario, failedStep, xmlSnapshot);

            const completion = await this.openai.chat.completions.create({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert test automation engineer specializing in mobile app testing with Appium. Analyze test failures and provide specific, actionable fix suggestions.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 2000
            });

            const response = completion.choices[0]?.message?.content;
            if (!response) {
                throw new Error('No response from OpenAI');
            }

            return this.parseAIResponse(response, scenario.name, `${scenario.name}_step_${failedStep.stepNumber}`);

        } catch (error) {
            vscode.window.showErrorMessage(`Error generating fix suggestion: ${error}`);
            return null;
        }
    }

    private buildPrompt(scenario: Scenario, failedStep: Step, xmlSnapshot?: string): string {
        const errorDetails = failedStep.error;
        const stepText = failedStep.text;
        
        // Extract the failed selector from error message
        const selectorMatch = errorDetails?.message?.match(/selector\s+"([^"]+)"/);
        const failedSelector = selectorMatch ? selectorMatch[1] : 'unknown';
        
        let prompt = `
## Test Scenario Analysis

**Scenario:** ${scenario.name}
**Failed Step:** ${stepText}
**Error Message:** ${errorDetails?.message || 'No error message available'}
**Error Type:** ${errorDetails?.type || 'Unknown'}
**Failed Selector:** ${failedSelector}

**Previous Steps Context:**
${scenario.steps
    .filter(step => step.stepNumber < failedStep.stepNumber)
    .map(step => `${step.stepNumber}. ${step.text} - ${step.status}`)
    .join('\n')}

**Error Stack Trace:**
${errorDetails?.stack || 'No stack trace available'}
`;

        if (xmlSnapshot) {
            prompt += `\n**Page Source (XML) - Analyze this to find the correct selector:**\n${xmlSnapshot}`;
        }

        prompt += `

## Analysis Request

The test failed because it couldn't find an element with selector "${failedSelector}". 

Please analyze the XML page source above and provide:

1. **Root Cause Analysis:** Why the selector "${failedSelector}" failed
2. **Available Elements:** List all relevant input fields, buttons, or elements that might be the intended target
3. **Correct Selector:** Provide the exact working selector(s) found in the XML that should replace "${failedSelector}"
4. **Fix Code:** Complete code fix with the correct selector
5. **Alternative Selectors:** Backup selectors in case the primary one fails
6. **Confidence Level:** How confident you are in the suggestion (1-10)

**Focus on finding these elements from the XML:**
- Input fields (android.widget.EditText, XCUIElementTypeTextField)
- Elements with text containing "username", "user", "login", "email"
- Elements with resource-id, accessibility-id, or content-desc attributes
- Clickable elements that might be the target

**Provide working selectors in these formats:**
- Accessibility ID: ~accessibility-id-value
- Resource ID: android=UiSelector().resourceId("resource.id")
- XPath: //android.widget.EditText[@attribute='value']
- Class name: android.widget.EditText

Be very specific and extract the exact attribute values from the XML.
`;

        return prompt;
    }

    private parseAIResponse(response: string, scenarioName: string, stepId: string): FixSuggestion {
        // Enhanced parsing for selector-specific suggestions
        const lines = response.split('\n');
        let suggestion = '';
        let reasoning = '';
        let confidence = 7; // Default confidence

        // Extract confidence if mentioned
        const confidenceMatch = response.match(/confidence.*?(\d+)/i);
        if (confidenceMatch) {
            confidence = parseInt(confidenceMatch[1]) || 7;
        }

        // Extract main suggestion (everything after first heading)
        const suggestionStart = response.indexOf('\n') + 1;
        suggestion = response.substring(suggestionStart).trim();

        // Try to extract reasoning from root cause section
        const rootCauseMatch = response.match(/root cause.*?:(.*?)(?=\n\n|\n#|$)/is);
        if (rootCauseMatch) {
            reasoning = rootCauseMatch[1].trim();
        }

        // Extract potential code changes with enhanced selector detection
        const codeChanges: CodeChange[] = [];
        
        // Look for code blocks
        const codeBlocks = response.match(/```[\s\S]*?```/g);
        if (codeBlocks) {
            codeBlocks.forEach((block, index) => {
                const code = block.replace(/```\w*\n?/, '').replace(/```$/, '');
                codeChanges.push({
                    filePath: `step_${stepId}_fix_${index + 1}.js`,
                    description: `AI suggested code change ${index + 1}`,
                    originalCode: 'Original code not specified',
                    suggestedCode: code.trim()
                });
            });
        }

        // Look for specific selector suggestions
        const selectorPatterns = [
            /accessibility\s+id[:\s]+[~]*([^\\n\\s]+)/gi,
            /resource\s+id[:\s]+([^\\n\\s]+)/gi,
            /xpath[:\s]+([^\\n\\s]+)/gi,
            /selector[:\s]+([^\\n\\s]+)/gi
        ];

        selectorPatterns.forEach((pattern, index) => {
            const matches = response.matchAll(pattern);
            for (const match of matches) {
                if (match[1]) {
                    const selectorType = ['Accessibility ID', 'Resource ID', 'XPath', 'General Selector'][index];
                    codeChanges.push({
                        filePath: `selector_fix_${selectorType.toLowerCase().replace(' ', '_')}.js`,
                        description: `${selectorType} selector suggestion`,
                        originalCode: 'Original selector not working',
                        suggestedCode: `// ${selectorType}\nconst element = driver.findElement('${match[1]}');\n// or\nconst element = $('${match[1]}');`
                    });
                }
            }
        });

        // Extract element analysis from XML
        const elementMatch = response.match(/available elements.*?:(.*?)(?=\n\n|\n#|$)/is);
        if (elementMatch) {
            const elements = elementMatch[1].trim();
            codeChanges.push({
                filePath: 'available_elements_analysis.txt',
                description: 'Available elements found in XML',
                originalCode: 'No elements found with original selector',
                suggestedCode: elements
            });
        }

        return {
            stepId,
            scenarioName,
            suggestion: suggestion || response,
            reasoning: reasoning || 'Analysis completed by AI with XML page source inspection',
            confidence: Math.min(Math.max(confidence, 1), 10),
            codeChanges: codeChanges.length > 0 ? codeChanges : undefined
        };
    }

    public refreshApiKey(): void {
        this.openai = null;
        this.initializeOpenAI();
    }
}
