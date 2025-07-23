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
            const model = config.get<string>('openaiModel', 'gpt-4o');

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

    private filterRelevantXml(xmlContent: string, failedSelector: string): string {
        // Extract the target type from failed selector
        const isUsernameField = /username|user|login|email/i.test(failedSelector);
        
        // Split XML into lines for processing
        const lines = xmlContent.split('\n');
        const relevantLines: string[] = [];
        let inRelevantNode = false;
        let nodeDepth = 0;
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Check if this line contains relevant elements
            const isRelevant = 
                trimmedLine.includes('EditText') ||
                trimmedLine.includes('TextField') ||
                trimmedLine.includes('input') ||
                (isUsernameField && (
                    /username|user|login|email|name/i.test(trimmedLine) ||
                    /resource-id.*username|user|login|email/i.test(trimmedLine) ||
                    /content-desc.*username|user|login|email/i.test(trimmedLine)
                )) ||
                trimmedLine.includes('clickable="true"') ||
                trimmedLine.includes('focusable="true"') ||
                trimmedLine.includes('text=') && trimmedLine.includes('input');
            
            // Track node depth for context
            if (trimmedLine.includes('<') && !trimmedLine.includes('</')) {
                if (isRelevant) {
                    inRelevantNode = true;
                    nodeDepth = 0;
                }
                if (inRelevantNode) {
                    nodeDepth++;
                }
            }
            
            if (trimmedLine.includes('</')) {
                if (inRelevantNode) {
                    nodeDepth--;
                    if (nodeDepth <= 0) {
                        inRelevantNode = false;
                    }
                }
            }
            
            // Include relevant lines and their context
            if (isRelevant || inRelevantNode) {
                relevantLines.push(line);
            }
        }
        
        // If we found relevant content, return it, otherwise return truncated original
        if (relevantLines.length > 0 && relevantLines.length < lines.length * 0.8) {
            return relevantLines.join('\n');
        }
        
        // Fallback to first part of XML
        return xmlContent.substring(0, 10000) + '\n... [Showing first part of XML]';
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
            // Filter and truncate XML to prevent token limit issues
            const config = vscode.workspace.getConfiguration('testFailureAnalyzer');
            const maxXmlLength = config.get<number>('maxXmlLength', 12000);
            
            const filteredXml = this.filterRelevantXml(xmlSnapshot, failedSelector);
            const truncatedXml = filteredXml.length > maxXmlLength 
                ? filteredXml.substring(0, maxXmlLength) + '\n... [XML truncated for token limit]'
                : filteredXml;
            
            prompt += `\n**Page Source (XML) - Filtered for relevant elements:**\n${truncatedXml}`;
        }

        prompt += `

## Analysis Request

The test failed because it couldn't find an element with selector "${failedSelector}". 

Please analyze the XML page source above and provide ONLY:

1. **Root Cause:** Why the selector "${failedSelector}" failed
2. **Working Selectors:** Extract the exact working selectors from the XML that match username/input fields
3. **Code Fix:** Complete working code with the correct selector found in XML
4. **Confidence Level:** Your confidence in this solution (1-10 scale)

**IMPORTANT:** 
- Only provide selectors that actually exist in the XML page source
- Focus on finding input fields for username/text entry
- Provide exact attribute values from the XML
- No generic suggestions - only what's actually found in the page source
- Include your confidence level based on how certain you are about the working selectors found

**Required selector formats from XML:**
- ~accessibility-id (if accessibility-id attribute exists)
- resource-id value (if resource-id attribute exists) 
- XPath based on actual XML structure
- Class name if that's the only option

Extract EXACT values from the XML provided above and rate your confidence in the solution.
`;

        return prompt;
    }

    private parseAIResponse(response: string, scenarioName: string, stepId: string): FixSuggestion {
        // Focused parsing for selector-specific suggestions only
        let suggestion = '';
        let reasoning = '';
        let confidence = 5; // Default fallback confidence

        // Extract confidence from OpenAI response with multiple patterns
        const confidencePatterns = [
            /confidence.*?level.*?(\d+)/i,
            /confidence.*?(\d+)/i,
            /(\d+).*?confidence/i,
            /confidence.*?(\d+).*?10/i,
            /rate.*?confidence.*?(\d+)/i
        ];

        for (const pattern of confidencePatterns) {
            const confidenceMatch = response.match(pattern);
            if (confidenceMatch) {
                const extractedConfidence = parseInt(confidenceMatch[1]);
                if (extractedConfidence >= 1 && extractedConfidence <= 10) {
                    confidence = extractedConfidence;
                    break;
                }
            }
        }

        // Extract main suggestion
        suggestion = response.trim();

        // Extract reasoning from root cause section
        const rootCauseMatch = response.match(/root cause.*?:(.*?)(?=\n\n|\n#|working|code)/is);
        if (rootCauseMatch) {
            reasoning = rootCauseMatch[1].trim();
        }

        // Extract only actual working code changes from code blocks
        const codeChanges: CodeChange[] = [];
        
        // Look for code blocks with working selectors
        const codeBlocks = response.match(/```[\s\S]*?```/g);
        if (codeBlocks) {
            codeBlocks.forEach((block, index) => {
                const code = block.replace(/```\w*\n?/, '').replace(/```$/, '');
                if (code.trim().length > 0) {
                    codeChanges.push({
                        filePath: `working_selector_fix_${index + 1}.js`,
                        description: `Working selector from XML analysis`,
                        originalCode: 'Element not found with original selector',
                        suggestedCode: code.trim()
                    });
                }
            });
        }

        // Only extract explicitly mentioned working selectors
        const workingSelectorMatch = response.match(/working.*?selector[s]*.*?:(.*?)(?=\n\n|\n#|$)/is);
        if (workingSelectorMatch) {
            const selectors = workingSelectorMatch[1].trim();
            if (selectors && !codeBlocks) {
                codeChanges.push({
                    filePath: 'xml_based_selectors.js',
                    description: 'Working selectors found in XML page source',
                    originalCode: '// Original selector not working',
                    suggestedCode: selectors
                });
            }
        }

        return {
            stepId,
            scenarioName,
            suggestion: suggestion || 'XML analysis completed - check working selectors below',
            reasoning: reasoning || 'Analyzed XML page source to find working selectors',
            confidence: Math.min(Math.max(confidence, 1), 10), // Ensure confidence is between 1-10
            codeChanges: codeChanges.length > 0 ? codeChanges : undefined
        };
    }

    public refreshApiKey(): void {
        this.openai = null;
        this.initializeOpenAI();
    }
}
