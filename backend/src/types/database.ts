import { 
  DatasetMetadata, 
  AnalysisParameters, 
  AnalysisResults, 
  VisualizationConfig, 
  ReportContent, 
  ActivityDetails 
} from './data-models.js';

// Core database model types
export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectCollaborator {
  id: string;
  userId: string;
  projectId: string;
  role: CollaboratorRole;
  joinedAt: Date;
}

export interface Dataset {
  id: string;
  name: string;
  filePath: string;
  fileSize: number;
  metadata: DatasetMetadata;
  userId: string;
  projectId: string | null;
  uploadedAt: Date;
}

export interface Analysis {
  id: string;
  name: string;
  type: AnalysisType;
  parameters: AnalysisParameters;
  results: AnalysisResults | null;
  status: AnalysisStatus;
  datasetId: string;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Visualization {
  id: string;
  name: string;
  type: VisualizationType;
  config: VisualizationConfig;
  analysisId: string | null;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Report {
  id: string;
  title: string;
  content: ReportContent;
  template: string | null;
  version: number;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  content: string;
  userId: string;
  projectId: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Activity {
  id: string;
  type: ActivityType;
  details: ActivityDetails;
  userId: string;
  projectId: string;
  createdAt: Date;
}

// Enums
export enum CollaboratorRole {
  VIEWER = 'VIEWER',
  EDITOR = 'EDITOR',
  ADMIN = 'ADMIN'
}

export enum AnalysisType {
  DESCRIPTIVE = 'DESCRIPTIVE',
  FREQUENCY = 'FREQUENCY',
  CORRELATION = 'CORRELATION',
  NORMALITY = 'NORMALITY',
  CROSSTAB = 'CROSSTAB',
  TTEST = 'TTEST',
  ANOVA = 'ANOVA',
  REGRESSION = 'REGRESSION',
  CHISQUARE = 'CHISQUARE',
  NONPARAMETRIC = 'NONPARAMETRIC'
}

export enum AnalysisStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum VisualizationType {
  BAR = 'BAR',
  LINE = 'LINE',
  SCATTER = 'SCATTER',
  HISTOGRAM = 'HISTOGRAM',
  BOXPLOT = 'BOXPLOT',
  HEATMAP = 'HEATMAP',
  PIE = 'PIE'
}

export enum ActivityType {
  PROJECT_CREATED = 'PROJECT_CREATED',
  PROJECT_UPDATED = 'PROJECT_UPDATED',
  DATASET_UPLOADED = 'DATASET_UPLOADED',
  ANALYSIS_CREATED = 'ANALYSIS_CREATED',
  ANALYSIS_COMPLETED = 'ANALYSIS_COMPLETED',
  REPORT_GENERATED = 'REPORT_GENERATED',
  USER_INVITED = 'USER_INVITED',
  COMMENT_ADDED = 'COMMENT_ADDED'
}