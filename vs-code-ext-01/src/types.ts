export interface TestResults {
  executionInfo: ExecutionInfo;
  summary: Summary;
  scenarios: Scenario[];
}

export interface ExecutionInfo {
  startTime: string;
  endTime: string;
  totalDuration: number;
  platform: string;
  device: string;
}

export interface Summary {
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  skippedScenarios: number;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  successRate: number;
}

export interface Scenario {
  name: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  startTime: string;
  endTime: string;
  duration: number;
  steps: Step[];
  errorSummary?: string | null;
}

export interface Step {
  stepNumber: number;
  text: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  timestamp: string;
  error?: StepError | null;
  artifacts?: Artifacts;
}

export interface StepError {
  message: string;
  type: string;
  stack: string;
}

export interface Artifacts {
  screenshot?: string;
  xmlSnapshot?: string;
}

export interface FixSuggestion {
  stepId: string;
  scenarioName: string;
  suggestion: string;
  reasoning: string;
  confidence: number;
  codeChanges?: CodeChange[];
}

export interface CodeChange {
  filePath: string;
  description: string;
  originalCode: string;
  suggestedCode: string;
  lineNumbers?: {
    start: number;
    end: number;
  };
}
