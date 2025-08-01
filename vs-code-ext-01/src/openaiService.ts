import * as vscode from 'vscode';
import OpenAI from 'openai';
import axios from 'axios';
import { Step, Scenario, FixSuggestion, CodeChange } from './types';

export class OpenAIService {
    private openai: OpenAI | null = null;
    private useOllama: boolean = false;
    private ollamaBaseUrl: string = 'http://localhost:11434';
    private ollamaModel: string = 'llama3';

    constructor() {
        this.initializeServices();
    }

    private initializeServices(): void {
        const config = vscode.workspace.getConfiguration('testFailureAnalyzer');
        this.useOllama = config.get<boolean>('useOllama', false);
        this.ollamaBaseUrl = config.get<string>('ollamaBaseUrl', 'http://localhost:11434');
        this.ollamaModel = config.get<string>('ollamaModel', 'llama3');

        if (true) {
            this.checkOllamaConnection();
        } else {
            console.log('🤖 Initializing OpenAI service');
            this.initializeOpenAI();
        }
    }

    private async checkOllamaConnection(): Promise<void> {
        try {
            const response = await axios.get(`${this.ollamaBaseUrl}/api/tags`);
            const models = response.data.models || [];
            
            if (!models.some((m: any) => m.name.includes(this.ollamaModel))) {
                vscode.window.showWarningMessage(
                    `Model ${this.ollamaModel} not found in Ollama. Available models: ${models.map((m: any) => m.name).join(', ')}`,
                    'Check Models'
                );
            } else {
                console.log(`✅ Ollama connected successfully with model: ${this.ollamaModel}`);
                vscode.window.showInformationMessage(`🦙 Ollama ready with ${this.ollamaModel}`, { modal: false });
            }
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to connect to Ollama at ${this.ollamaBaseUrl}. Make sure Ollama is running.`,
                'Check Connection'
            );
        }
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
            console.log('✅ OpenAI service initialized successfully');
            vscode.window.showInformationMessage('🤖 OpenAI service ready', { modal: false });
        } catch (error) {
            vscode.window.showErrorMessage(`Error initializing OpenAI: ${error}`);
        }
    }

    public async generateFixSuggestion(
        scenario: Scenario,
        failedStep: Step,
        xmlSnapshot?: string
    ): Promise<FixSuggestion | null> {
        // Show which AI service is being used
        if (this.useOllama) {
            vscode.window.showInformationMessage(`🦙 Using Ollama (${this.ollamaModel}) for AI analysis...`, { modal: false });
        } else {
            const config = vscode.workspace.getConfiguration('testFailureAnalyzer');
            const model = config.get<string>('openaiModel', 'gpt-4o');
            vscode.window.showInformationMessage(`🤖 Using OpenAI (${model}) for AI analysis...`, { modal: false });
        }

        if (this.useOllama) {
            return this.generateFixSuggestionWithOllama(scenario, failedStep, xmlSnapshot);
        } else {
            return this.generateFixSuggestionWithOpenAI(scenario, failedStep, xmlSnapshot);
        }
    }

    private async generateFixSuggestionWithOpenAI(
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
                        content: 'You are an expert test automation engineer specializing in mobile app testing with Appium and JavaScript/Node.js. Analyze test failures and provide specific, actionable fix suggestions. Always provide code solutions in JavaScript format for Node.js projects.'
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
            vscode.window.showErrorMessage(`Error generating fix suggestion with OpenAI: ${error}`);
            return null;
        }
    }

    private async generateFixSuggestionWithOllama(
        scenario: Scenario,
        failedStep: Step,
        xmlSnapshot?: string
    ): Promise<FixSuggestion | null> {
        try {
            const prompt = this.buildPrompt(scenario, failedStep, xmlSnapshot);

            const response = await axios.post(`${this.ollamaBaseUrl}/api/generate`, {
                model: this.ollamaModel,
                prompt: `You are an expert test automation engineer specializing in mobile app testing with Appium and JavaScript/Node.js. Analyze test failures and provide specific, actionable fix suggestions. Always provide code solutions in JavaScript format for Node.js projects.\n\n${prompt}`,
                stream: false,
                options: {
                    temperature: 0.1,
                    top_p: 0.9,
                    num_predict: 2000
                }
            });

            const aiResponse = response.data.response;
            if (!aiResponse) {
                throw new Error('No response from Ollama');
            }

            const result = this.parseAIResponse(aiResponse, scenario.name, `${scenario.name}_step_${failedStep.stepNumber}`);
            
            // Show completion message
            vscode.window.showInformationMessage(`✅ Ollama analysis complete (Confidence: ${result.confidence}/10)`, { modal: false });
            
            return result;

        } catch (error) {
            vscode.window.showErrorMessage(`Error generating fix suggestion with Ollama: ${error}`);
            return null;
        }
    }

    private filterRelevantXml(xmlContent: string, errorMessage: string, stepText: string): string {
        // Analyze error message to determine what type of elements might be relevant
        const errorType = this.categorizeError(errorMessage);
        
        // Split XML into lines for processing
        const lines = xmlContent.split('\n');
        const relevantLines: string[] = [];
        let inRelevantNode = false;
        let nodeDepth = 0;
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Determine relevance based on error type and step context
            const isRelevant = this.isElementRelevant(trimmedLine, errorType, stepText);
            
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

    private categorizeError(errorMessage: string): string {
        const message = errorMessage.toLowerCase();
        
        if (message.includes('no such element') || message.includes('element not found') || message.includes('could not find')) {
            return 'element_not_found';
        } else if (message.includes('not clickable') || message.includes('click intercepted') || message.includes('not interactable')) {
            return 'not_clickable';
        } else if (message.includes('timeout') || message.includes('timed out')) {
            return 'timeout';
        } else if (message.includes('stale') || message.includes('no longer attached')) {
            return 'stale_element';
        } else if (message.includes('permission') || message.includes('access denied')) {
            return 'permission_error';
        } else if (message.includes('invalid selector') || message.includes('invalid locator')) {
            return 'invalid_selector';
        } else if (message.includes('network') || message.includes('connection')) {
            return 'network_error';
        } else if (message.includes('assertion') || message.includes('expected') || message.includes('actual')) {
            return 'assertion_failure';
        } else {
            return 'unknown_error';
        }
    }

    private isElementRelevant(line: string, errorType: string, stepText: string): boolean {
        const trimmedLine = line.trim();
        const stepLower = stepText.toLowerCase();
        
        // Base relevance for interactive elements
        const baseRelevant = 
            trimmedLine.includes('clickable="true"') ||
            trimmedLine.includes('focusable="true"') ||
            trimmedLine.includes('enabled="true"') ||
            trimmedLine.includes('EditText') ||
            trimmedLine.includes('Button') ||
            trimmedLine.includes('ImageView') ||
            trimmedLine.includes('TextView');

        // Additional relevance based on error type
        switch (errorType) {
            case 'element_not_found':
                // For element not found, focus on elements mentioned in step text
                const stepKeywords = this.extractKeywordsFromStep(stepText);
                return baseRelevant || stepKeywords.some(keyword => 
                    trimmedLine.toLowerCase().includes(keyword.toLowerCase())
                );
            
            case 'not_clickable':
                // For clickability issues, focus on clickable elements and overlays
                return trimmedLine.includes('clickable=') ||
                       trimmedLine.includes('enabled=') ||
                       trimmedLine.includes('visibility=') ||
                       trimmedLine.includes('displayed=');
            
            case 'timeout':
                // For timeouts, include loading indicators and async elements
                return baseRelevant ||
                       trimmedLine.includes('ProgressBar') ||
                       trimmedLine.includes('loading') ||
                       trimmedLine.includes('spinner');
            
            case 'stale_element':
                // For stale elements, include the entire hierarchy for re-finding
                return true; // Include more context for stale element errors
            
            default:
                return baseRelevant;
        }
    }

    private extractKeywordsFromStep(stepText: string): string[] {
        // Extract meaningful keywords from step text for element matching
        const keywords = [];
        const words = stepText.toLowerCase().split(/\s+/);
        
        // Common UI element keywords
        const uiKeywords = ['button', 'field', 'input', 'text', 'login', 'username', 'password', 'email', 'submit', 'search', 'menu', 'tab', 'link'];
        
        for (const word of words) {
            if (uiKeywords.includes(word) || word.length > 4) {
                keywords.push(word);
            }
        }
        
        return keywords;
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
            
            const filteredXml = this.filterRelevantXml(xmlSnapshot, errorDetails?.message || '', stepText);
            const truncatedXml = filteredXml.length > maxXmlLength 
                ? filteredXml.substring(0, maxXmlLength) + '\n... [XML truncated for token limit]'
                : filteredXml;
            
            prompt += `\n**Page Source (XML) - Filtered for relevant elements:**\n${truncatedXml}`;
        }

        // Customize analysis request based on error type
        const errorMessage = errorDetails?.message || 'No error message available';
        const errorType = this.categorizeError(errorMessage);
        prompt += this.buildAnalysisRequest(errorType, stepText, failedSelector, errorMessage);

        return prompt;
    }

    private buildAnalysisRequest(errorType: string, stepText: string, failedSelector: string, errorMessage: string): string {
        const baseRequest = `

## Analysis Request

Based on the error category "${errorType}", please analyze the test failure and provide:

1. **Root Cause:** Why this specific error occurred
2. **Solution Strategy:** The best approach to fix this issue
3. **Code Fix:** Complete working JavaScript/Node.js code with the necessary changes
4. **Prevention Tips:** How to avoid this error in the future
5. **Confidence Level:** Your confidence in this solution (1-10 scale)

**IMPORTANT:** Provide all code solutions in JavaScript format for Node.js/Appium projects. Use JavaScript syntax with async/await, const/let declarations, and modern ES6+ features.

`;

        switch (errorType) {
            case 'element_not_found':
                return baseRequest + `
**Specific Analysis for Element Not Found:**
- Analyze the XML page source to find working selectors for elements mentioned in "${stepText}"
- Extract exact working selectors from the XML that match the intended functionality
- Provide alternative locator strategies (ID, accessibility-id, XPath, class name)
- Consider timing issues and suggest explicit waits if needed
- Provide solutions using JavaScript/Node.js Appium WebDriver syntax

**Required selector formats from XML:**
- accessibility-id (if accessibility-id attribute exists)
- resource-id value (if resource-id attribute exists) 
- XPath based on actual XML structure
- Class name or text-based selectors as alternatives

**JavaScript Code Format Required:**
\`\`\`javascript
// Use modern JavaScript syntax with async/await
const element = await driver.findElement(By.accessibilityId('your-id'));
await element.click();
\`\`\`

Focus on finding the exact element that should be interacted with based on the step text and XML structure.
`;

            case 'not_clickable':
                return baseRequest + `
**Specific Analysis for Clickability Issues:**
- Check if the element exists but is not clickable (covered by another element, disabled, etc.)
- Analyze element properties like enabled, clickable, displayed from XML
- Suggest solutions like scrolling, waiting for element to be clickable, or finding alternative click targets
- Consider using JavaScript click or action chains if standard click fails
- Provide solutions using JavaScript/Node.js Appium WebDriver syntax

**JavaScript Code Format Required:**
\`\`\`javascript
// Example: Wait for element to be clickable
const element = await driver.wait(until.elementIsEnabled(driver.findElement(By.id('button-id'))), 10000);
await element.click();
\`\`\`

**Focus Areas:**
- Element visibility and interactability
- Overlapping elements or modal dialogs
- Timing issues with dynamic content
- Alternative interaction methods
`;

            case 'timeout':
                return baseRequest + `
**Specific Analysis for Timeout Issues:**
- Identify what the test was waiting for when it timed out
- Suggest appropriate wait strategies (explicit waits, condition-based waits)
- Analyze if the timeout duration is appropriate
- Look for loading indicators or async operations in the XML

**Focus Areas:**
- Appropriate wait conditions
- Timeout duration adjustments
- Loading states and progress indicators
- Network delays and app performance
`;

            case 'stale_element':
                return baseRequest + `
**Specific Analysis for Stale Element Issues:**
- Understand why the element reference became stale
- Suggest strategies to re-find elements after page changes
- Recommend using fresh element lookups instead of storing references
- Analyze the DOM structure changes that caused staleness

**Focus Areas:**
- Element re-finding strategies
- Avoiding stored element references
- Understanding page state changes
- Robust element interaction patterns
`;

            case 'assertion_failure':
                return baseRequest + `
**Specific Analysis for Assertion Failures:**
- Compare expected vs actual values from the error message
- Analyze why the assertion failed (timing, incorrect expectation, app bug)
- Suggest corrected assertions or wait strategies
- Consider if the test expectation is valid

**Focus Areas:**
- Expected vs actual value analysis
- Assertion timing and conditions
- Test data validation
- App behavior verification
`;

            case 'permission_error':
                return baseRequest + `
**Specific Analysis for Permission/Access Issues:**
- Identify what permissions or access rights are missing
- Suggest configuration changes or test setup improvements
- Analyze if this is an environment-specific issue
- Consider alternative approaches that don't require elevated permissions

**Focus Areas:**
- Required permissions and capabilities
- Test environment configuration
- Alternative testing approaches
- Security context considerations
`;

            case 'network_error':
                return baseRequest + `
**Specific Analysis for Network Issues:**
- Identify the network operation that failed
- Suggest retry mechanisms or network configuration
- Analyze if this is environment-specific or a test design issue
- Consider mocking or stubbing network calls for stability

**Focus Areas:**
- Network connectivity and configuration
- Retry and fallback strategies
- Test environment network setup
- API mocking and testing approaches
`;

            default:
                return baseRequest + `
**General Error Analysis:**
- Analyze the specific error message and stack trace
- Identify patterns or known causes for this type of error
- Suggest debugging approaches to understand the root cause
- Provide general best practices for robust test automation

**Focus Areas:**
- Error message interpretation
- Debugging strategies
- Test stability improvements
- Best practice recommendations
`;
        }
    }

    private parseAIResponse(response: string, scenarioName: string, stepId: string): FixSuggestion {
        let suggestion = '';
        let reasoning = '';
        let confidence = 5; // Default fallback confidence

        // Extract confidence from AI response with multiple patterns
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

        // Extract main suggestion - use full response as suggestion
        suggestion = response.trim();

        // Extract reasoning from root cause section
        const rootCauseMatch = response.match(/root cause.*?:(.*?)(?=\n\n|\n#|solution|code|prevention)/is);
        if (rootCauseMatch) {
            reasoning = rootCauseMatch[1].trim();
        }

        // Extract code changes from various sections
        const codeChanges: CodeChange[] = [];
        
        // Look for code blocks with fixes
        const codeBlocks = response.match(/```[\s\S]*?```/g);
        if (codeBlocks) {
            codeBlocks.forEach((block, index) => {
                const code = block.replace(/```\w*\n?/, '').replace(/```$/, '');
                if (code.trim().length > 0) {
                    // Determine file extension based on content
                    const extension = this.determineFileExtension(code);
                    codeChanges.push({
                        filePath: `suggested_fix_${index + 1}.${extension}`,
                        description: `JavaScript fix suggestion #${index + 1}`,
                        originalCode: '// Original code with error',
                        suggestedCode: code.trim()
                    });
                }
            });
        }

        // Extract working selectors section if present
        const workingSelectorMatch = response.match(/working.*?selector[s]*.*?:(.*?)(?=\n\n|\n#|$)/is);
        if (workingSelectorMatch && !codeBlocks) {
            const selectors = workingSelectorMatch[1].trim();
            if (selectors) {
                codeChanges.push({
                    filePath: 'working_selectors.js',
                    description: 'JavaScript selectors found by AI analysis',
                    originalCode: '// Original selector not working',
                    suggestedCode: selectors
                });
            }
        }

        // Extract solution strategy if no code blocks found
        const solutionMatch = response.match(/solution.*?strategy.*?:(.*?)(?=\n\n|\n#|code|prevention)/is);
        if (solutionMatch && codeChanges.length === 0) {
            const solutionText = solutionMatch[1].trim();
            if (solutionText.length > 20) {
                codeChanges.push({
                    filePath: 'solution_strategy.js',
                    description: 'JavaScript solution approach',
                    originalCode: '// Problem identified',
                    suggestedCode: `// Solution Strategy:\n${solutionText}`
                });
            }
        }

        return {
            stepId,
            scenarioName,
            suggestion: suggestion || 'AI analysis completed - check suggestions below',
            reasoning: reasoning || 'AI analyzed the error and provided recommendations',
            confidence: Math.min(Math.max(confidence, 1), 10), // Ensure confidence is between 1-10
            codeChanges: codeChanges.length > 0 ? codeChanges : undefined
        };
    }

    private determineFileExtension(code: string): string {
        const codeContent = code.toLowerCase();
        
        // Check for specific language patterns
        if (codeContent.includes('def ') || codeContent.includes('import pytest') || codeContent.includes('from ')) {
            return 'py';
        } else if (codeContent.includes('public class') || codeContent.includes('private ') || codeContent.includes('@test')) {
            return 'java';
        } else if (codeContent.includes('xpath') || codeContent.includes('accessibility-id') || codeContent.includes('resource-id')) {
            return 'selector';
        } else if (codeContent.includes('function') || codeContent.includes('await') || codeContent.includes('const ') || 
                   codeContent.includes('let ') || codeContent.includes('var ') || codeContent.includes('=>') ||
                   codeContent.includes('driver.') || codeContent.includes('webdriver') || codeContent.includes('selenium') ||
                   codeContent.includes('element.') || codeContent.includes('by.') || codeContent.includes('expect(')) {
            return 'js';
        } else {
            // Default to JavaScript for Node.js project
            return 'js';
        }
    }

    public refreshApiKey(): void {
        this.openai = null;
        this.initializeServices();
    }
}
