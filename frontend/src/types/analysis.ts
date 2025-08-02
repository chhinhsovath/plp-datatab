import { ColumnInfo } from './data';

export interface AnalysisConfig {
  testType: string;
  testName: string;
  description: string;
  variables: string[];
  parameters: { [key: string]: any };
  assumptions: string[];
  alternatives?: string[];
}

export interface AnalysisResult {
  analysisId: string;
  testType: string;
  statistics: any;
  interpretation: string;
  assumptions: AssumptionResult[];
  summary: string;
  recommendations?: string[];
}

export interface AssumptionResult {
  assumption: string;
  met: boolean;
  test?: string;
  statistic?: number;
  pValue?: number;
  recommendation?: string;
}

export interface TestSuggestion {
  testName: string;
  testType: string;
  reason: string;
  assumptions: string[];
  alternatives?: string[];
  confidence: number;
}

export interface StatisticalTest {
  id: string;
  name: string;
  category: 'descriptive' | 'parametric' | 'nonparametric' | 'correlation' | 'regression';
  description: string;
  assumptions: string[];
  minVariables: number;
  maxVariables: number;
  variableTypes: ('numeric' | 'categorical')[];
  sampleSizeRequirement: string;
  examples: string[];
}

export interface ParameterConfig {
  name: string;
  type: 'select' | 'number' | 'boolean' | 'variable';
  label: string;
  description: string;
  required: boolean;
  options?: { value: any; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: any;
  dependsOn?: string;
  variableFilter?: (column: ColumnInfo) => boolean;
}

export interface AnalysisStep {
  title: string;
  description: string;
  component: React.ComponentType<any>;
  validation?: (data: any) => string | null;
}

export interface HelpContent {
  title: string;
  content: string;
  examples?: string[];
  references?: string[];
}