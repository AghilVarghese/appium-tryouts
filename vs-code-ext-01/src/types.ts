// Original format types (for backward compatibility)
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

// New Cucumber/WebDriverIO format types
export interface CucumberTestResults {
  features: CucumberFeature[];
}

export interface CucumberFeature {
  keyword: string;
  type: string;
  description: string;
  line: number;
  name: string;
  uri: string;
  tags: CucumberTag[];
  elements: CucumberScenario[];
  id: string;
  metadata: CucumberMetadata;
}

export interface CucumberTag {
  name: string;
  astNodeId?: string;
}

export interface CucumberScenario {
  keyword: string;
  type: string;
  description: string;
  name: string;
  tags: CucumberTag[];
  id: string;
  steps: CucumberStep[];
}

export interface CucumberStep {
  arguments: any[];
  keyword: string;
  name: string;
  result: CucumberStepResult;
  line: number | null;
  match: CucumberMatch;
  embeddings?: CucumberEmbedding[];
  artifacts?: CucumberArtifacts;
}

export interface CucumberStepResult {
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error_message?: string;
}

export interface CucumberMatch {
  location: string;
}

export interface CucumberEmbedding {
  data: string;
  mime_type: string;
}

export interface CucumberArtifacts {
  ScreenshotPath?: string;
  PageSourcePath?: string;
}

export interface CucumberMetadata {
  browser: {
    name: string;
    version: string;
  };
  device: string;
  platform: {
    name: string;
    version: string;
  };
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
