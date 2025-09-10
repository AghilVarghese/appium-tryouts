
import axios from 'axios';
import * as vscode from 'vscode';
import { Scenario, Step, FixSuggestion, CodeChange } from './types';
import * as fs from 'fs';
import FormData from 'form-data';

export class SuggestFixService {
    public async getFixSuggestion(
        stepText: string,
        error: string,
        xmlSnapshotPath: string,
        llmType: string = 'openai'
    ): Promise<FixSuggestion | null> {
        try {
            const formData = new FormData();
            formData.append('step', stepText);
            formData.append('error', error);
            formData.append('xml_snapshot', fs.createReadStream(xmlSnapshotPath));
            const llmProvider = vscode.workspace.getConfiguration('testFailureAnalyzer').get<string>('llmProvider') || llmType;
            formData.append('llm_type', llmProvider);

            const response = await axios.post('http://localhost:5010/api/v2/suggest-fix', formData, {
                headers: formData.getHeaders(),
            });

            if (response.data) {
                // Adapt to new response format
                return this.parseSuggestFixResponse({
                    'File': response.data.file,
                    'Line Number': response.data.lineNumber,
                    'New Code': response.data.newCode,
                    'Old Code': response.data.oldCode,
                    'Reason': response.data.reason,
                    'Suggested code change': response.data.suggestedCodeChange
                });
            }
            return null;
        } catch (err) {
            vscode.window.showErrorMessage(`SuggestFixService error: ${err}`);
            return null;
        }
    }

    private parseSuggestFixResponse(data: any): FixSuggestion {
        // Map the response fields to FixSuggestion
        const codeChange: CodeChange = {
            filePath: data['File'] || '',
            description: data['Suggested code change'] || '',
            originalCode: data['Old Code'] || '',
            suggestedCode: data['New Code'] || '',
            lineNumbers: data['Line Number'] ? { start: Number(data['Line Number']), end: Number(data['Line Number']) } : undefined
        };
        return {
            stepId: '', // To be set by caller
            scenarioName: '', // To be set by caller
            suggestion: data['Suggested code change'] || '',
            reasoning: data['Reason'] || '',
            confidence: 8, // Default or parse if available
            codeChanges: [codeChange]
        };
    }
}
