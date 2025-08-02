import apiClient from './api';
import { AnalysisResult } from '../types/analysis';

export interface TestSuggestionsRequest {
  variables: string[];
  numGroups?: number;
  pairedData?: boolean;
}

export interface DescriptiveStatsRequest {
  column: string;
}

export interface FrequencyAnalysisRequest {
  column: string;
  binCount?: number;
}

export interface CorrelationRequest {
  columns: string[];
  method?: 'pearson' | 'spearman';
}

export interface NormalityTestRequest {
  column: string;
  tests?: string[];
  alpha?: number;
}

export interface TTestRequest {
  testType: 'one-sample' | 'independent' | 'paired';
  variable1: string;
  variable2?: string;
  populationMean?: number;
  equalVariances?: boolean;
  alpha?: number;
}

export interface ANOVARequest {
  dependentVariable: string;
  groupingVariable: string;
  alpha?: number;
}

export interface RegressionRequest {
  dependentVariable: string;
  independentVariable: string;
  alpha?: number;
}

export interface NonParametricTestRequest {
  testType: 'mann-whitney' | 'wilcoxon' | 'kruskal-wallis';
  variable1: string;
  variable2?: string;
  groupingVariable?: string;
  alpha?: number;
}

export interface ContingencyTableRequest {
  rowVariable: string;
  columnVariable: string;
}

export const analysisApi = {
  // Test suggestions
  getTestSuggestions: (datasetId: string, request: TestSuggestionsRequest) =>
    apiClient.post(`/statistical-analysis/suggest-tests/${datasetId}`, request),

  // Descriptive statistics
  calculateDescriptiveStats: (datasetId: string, columnName: string) =>
    apiClient.post<AnalysisResult>(`/statistical-analysis/descriptive/${datasetId}/${columnName}`),

  // Frequency analysis
  performFrequencyAnalysis: (datasetId: string, columnName: string, request: FrequencyAnalysisRequest) =>
    apiClient.post<AnalysisResult>(`/statistical-analysis/frequency/${datasetId}/${columnName}`, request),

  // Correlation analysis
  calculateCorrelation: (datasetId: string, request: CorrelationRequest) =>
    apiClient.post<AnalysisResult>(`/statistical-analysis/correlation/${datasetId}`, request),

  // Normality tests
  performNormalityTests: (datasetId: string, columnName: string, request: NormalityTestRequest) =>
    apiClient.post<AnalysisResult>(`/statistical-analysis/normality/${datasetId}/${columnName}`, request),

  // t-tests
  performTTest: (datasetId: string, request: TTestRequest) =>
    apiClient.post<AnalysisResult>(`/statistical-analysis/t-test/${datasetId}`, request),

  // ANOVA
  performANOVA: (datasetId: string, request: ANOVARequest) =>
    apiClient.post<AnalysisResult>(`/statistical-analysis/anova/${datasetId}`, request),

  // Regression
  performRegression: (datasetId: string, request: RegressionRequest) =>
    apiClient.post<AnalysisResult>(`/statistical-analysis/regression/${datasetId}`, request),

  // Non-parametric tests
  performNonParametricTest: (datasetId: string, request: NonParametricTestRequest) =>
    apiClient.post<AnalysisResult>(`/statistical-analysis/nonparametric/${datasetId}`, request),

  // Contingency table
  createContingencyTable: (datasetId: string, request: ContingencyTableRequest) =>
    apiClient.post<AnalysisResult>(`/statistical-analysis/contingency/${datasetId}`, request),
};