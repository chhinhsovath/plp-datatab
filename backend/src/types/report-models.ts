export interface Report {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  userId: string;
  sections: ReportSection[];
  template: ReportTemplate;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  collaborators: ReportCollaborator[];
}

export interface ReportSection {
  id: string;
  type: 'text' | 'analysis' | 'visualization' | 'table' | 'code';
  title: string;
  content: any;
  order: number;
  formatting: SectionFormatting;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  sections: TemplateSectionConfig[];
  styling: TemplateStyle;
  isDefault: boolean;
}

export interface TemplateSectionConfig {
  type: ReportSection['type'];
  title: string;
  required: boolean;
  defaultContent?: any;
  formatting: SectionFormatting;
}

export interface SectionFormatting {
  fontSize?: number;
  fontFamily?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  spacing?: {
    before: number;
    after: number;
  };
  indentation?: number;
  pageBreakBefore?: boolean;
  pageBreakAfter?: boolean;
}

export interface TemplateStyle {
  pageSize: 'A4' | 'Letter' | 'Legal';
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  headerFooter: {
    includeHeader: boolean;
    includeFooter: boolean;
    headerText?: string;
    footerText?: string;
  };
  typography: {
    titleFont: string;
    bodyFont: string;
    codeFont: string;
  };
}

export interface ReportCollaborator {
  userId: string;
  role: 'viewer' | 'editor' | 'admin';
  permissions: {
    canEdit: boolean;
    canComment: boolean;
    canExport: boolean;
    canShare: boolean;
  };
  joinedAt: Date;
}

export interface ReportVersion {
  id: string;
  reportId: string;
  version: number;
  title: string;
  sections: ReportSection[];
  createdBy: string;
  createdAt: Date;
  changeLog: string;
}

export interface ReportExportOptions {
  format: 'pdf' | 'docx' | 'html';
  includeCharts: boolean;
  includeRawData: boolean;
  applyAPAFormatting: boolean;
  customStyling?: Partial<TemplateStyle>;
}

export interface StatisticalTable {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  caption?: string;
  notes?: string[];
  formatting: {
    applyAPA: boolean;
    decimalPlaces: number;
    significanceMarkers: boolean;
  };
}

export interface AnalysisResult {
  id: string;
  type: string;
  title: string;
  summary: string;
  tables: StatisticalTable[];
  charts: ChartData[];
  interpretation: string;
  assumptions: AssumptionCheck[];
  recommendations: string[];
}

export interface ChartData {
  id: string;
  type: string;
  title: string;
  data: any;
  config: any;
  caption?: string;
}

export interface AssumptionCheck {
  name: string;
  result: 'passed' | 'failed' | 'warning';
  description: string;
  recommendation?: string;
}

export interface ReportComment {
  id: string;
  reportId: string;
  sectionId?: string;
  userId: string;
  content: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
  resolved: boolean;
}

export interface ReportActivity {
  id: string;
  reportId: string;
  userId: string;
  action: 'created' | 'updated' | 'commented' | 'exported' | 'shared';
  details: string;
  timestamp: Date;
}