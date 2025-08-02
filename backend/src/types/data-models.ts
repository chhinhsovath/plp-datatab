// Dataset metadata and column information
export interface DatasetMetadata {
  columns: ColumnInfo[];
  rowCount: number;
  fileType: 'csv' | 'excel' | 'json';
  encoding?: string;
  delimiter?: string;
  hasHeader: boolean;
  sheets?: string[]; // For Excel files
  selectedSheet?: string;
  importedAt: Date;
  originalFileName: string;
}

export interface ColumnInfo {
  name: string;
  dataType: DataType;
  missingValues: number;
  uniqueValues: number;
  statistics?: DescriptiveStats;
  sampleValues?: any[];
}

export enum DataType {
  NUMERIC = 'numeric',
  CATEGORICAL = 'categorical',
  DATE = 'date',
  TEXT = 'text',
  BOOLEAN = 'boolean'
}

// Statistical analysis types
export interface DescriptiveStats {
  mean?: number;
  median?: number;
  mode?: number;
  standardDeviation?: number;
  variance?: number;
  min?: number;
  max?: number;
  quartiles?: [number, number, number]; // Q1, Q2, Q3
  skewness?: number;
  kurtosis?: number;
  count: number;
  nullCount: number;
}

export interface AnalysisParameters {
  variables: string[];
  options: Record<string, any>;
  filters?: DataFilter[];
  groupBy?: string[];
  confidenceLevel?: number;
  alpha?: number;
}

export interface AnalysisResults {
  testStatistic?: number;
  pValue?: number;
  confidenceInterval?: [number, number];
  effectSize?: number;
  degreesOfFreedom?: number;
  interpretation: string;
  assumptions: AssumptionResult[];
  tables?: StatisticalTable[];
  plots?: PlotData[];
  summary: string;
  warnings?: string[];
}

export interface AssumptionResult {
  name: string;
  test: string;
  result: 'passed' | 'failed' | 'warning';
  pValue?: number;
  statistic?: number;
  message: string;
}

export interface StatisticalTable {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  footnotes?: string[];
}

export interface PlotData {
  type: string;
  data: any;
  layout?: any;
  config?: any;
}

// Data preprocessing types
export interface DataFilter {
  column: string;
  operator: FilterOperator;
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export enum FilterOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  GREATER_EQUAL = 'greater_equal',
  LESS_EQUAL = 'less_equal',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  IS_NULL = 'is_null',
  IS_NOT_NULL = 'is_not_null',
  IN = 'in',
  NOT_IN = 'not_in'
}

export interface PreprocessingOperation {
  type: PreprocessingType;
  column?: string;
  parameters: Record<string, any>;
}

export enum PreprocessingType {
  REMOVE_DUPLICATES = 'remove_duplicates',
  HANDLE_MISSING = 'handle_missing',
  CONVERT_TYPE = 'convert_type',
  FILTER_ROWS = 'filter_rows',
  CREATE_VARIABLE = 'create_variable',
  REMOVE_OUTLIERS = 'remove_outliers',
  NORMALIZE = 'normalize',
  STANDARDIZE = 'standardize'
}

// Visualization configuration
export interface VisualizationConfig {
  chartType: string;
  data: {
    x?: string;
    y?: string | string[];
    color?: string;
    size?: string;
    facet?: string;
  };
  styling: {
    title?: string;
    xLabel?: string;
    yLabel?: string;
    colors?: string[];
    theme?: string;
    width?: number;
    height?: number;
  };
  interactivity: {
    tooltip?: boolean;
    zoom?: boolean;
    brush?: boolean;
    hover?: boolean;
  };
  layout?: {
    showLegend?: boolean;
    legendPosition?: 'top' | 'bottom' | 'left' | 'right';
    margin?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  };
}

// Report content structure
export interface ReportContent {
  sections: ReportSection[];
  metadata: {
    author?: string;
    createdAt: Date;
    lastModified: Date;
    version: number;
    template?: string;
  };
  styling: {
    theme?: string;
    fontSize?: number;
    fontFamily?: string;
    pageSize?: 'A4' | 'Letter';
    margins?: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };
}

export interface ReportSection {
  id: string;
  type: ReportSectionType;
  title?: string;
  content: any;
  order: number;
  formatting?: {
    alignment?: 'left' | 'center' | 'right';
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
  };
}

export enum ReportSectionType {
  TEXT = 'text',
  ANALYSIS = 'analysis',
  VISUALIZATION = 'visualization',
  TABLE = 'table',
  CODE = 'code',
  PAGE_BREAK = 'page_break'
}

// Activity details
export interface ActivityDetails {
  action: string;
  resourceType: string;
  resourceId: string;
  resourceName?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
}

// Import enums from database types
import { CollaboratorRole, AnalysisType, VisualizationType } from './database.js';

// API request/response types
export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  isArchived?: boolean;
}

export interface InviteCollaboratorRequest {
  email: string;
  role: CollaboratorRole;
}

export interface CreateAnalysisRequest {
  name: string;
  type: AnalysisType;
  datasetId: string;
  parameters: AnalysisParameters;
}

export interface CreateVisualizationRequest {
  name: string;
  type: VisualizationType;
  config: VisualizationConfig;
  analysisId?: string;
}

export interface CreateReportRequest {
  title: string;
  template?: string;
  sections?: ReportSection[];
}

// Pagination and filtering
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Error types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  requestId: string;
}