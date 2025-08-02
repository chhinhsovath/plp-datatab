import { describe, it, expect } from 'vitest';
import { 
  CollaboratorRole, 
  AnalysisType, 
  AnalysisStatus, 
  VisualizationType, 
  ActivityType,
  DataType,
  FilterOperator,
  PreprocessingType,
  ReportSectionType
} from '../types/index.js';

describe('Data Models and Types', () => {
  it('should have correct enum values for CollaboratorRole', () => {
    expect(CollaboratorRole.VIEWER).toBe('VIEWER');
    expect(CollaboratorRole.EDITOR).toBe('EDITOR');
    expect(CollaboratorRole.ADMIN).toBe('ADMIN');
  });

  it('should have correct enum values for AnalysisType', () => {
    expect(AnalysisType.DESCRIPTIVE).toBe('DESCRIPTIVE');
    expect(AnalysisType.TTEST).toBe('TTEST');
    expect(AnalysisType.ANOVA).toBe('ANOVA');
    expect(AnalysisType.CORRELATION).toBe('CORRELATION');
    expect(AnalysisType.REGRESSION).toBe('REGRESSION');
    expect(AnalysisType.CHISQUARE).toBe('CHISQUARE');
    expect(AnalysisType.NONPARAMETRIC).toBe('NONPARAMETRIC');
  });

  it('should have correct enum values for AnalysisStatus', () => {
    expect(AnalysisStatus.PENDING).toBe('PENDING');
    expect(AnalysisStatus.RUNNING).toBe('RUNNING');
    expect(AnalysisStatus.COMPLETED).toBe('COMPLETED');
    expect(AnalysisStatus.FAILED).toBe('FAILED');
  });

  it('should have correct enum values for VisualizationType', () => {
    expect(VisualizationType.BAR).toBe('BAR');
    expect(VisualizationType.LINE).toBe('LINE');
    expect(VisualizationType.SCATTER).toBe('SCATTER');
    expect(VisualizationType.HISTOGRAM).toBe('HISTOGRAM');
    expect(VisualizationType.BOXPLOT).toBe('BOXPLOT');
    expect(VisualizationType.HEATMAP).toBe('HEATMAP');
    expect(VisualizationType.PIE).toBe('PIE');
  });

  it('should have correct enum values for ActivityType', () => {
    expect(ActivityType.PROJECT_CREATED).toBe('PROJECT_CREATED');
    expect(ActivityType.PROJECT_UPDATED).toBe('PROJECT_UPDATED');
    expect(ActivityType.DATASET_UPLOADED).toBe('DATASET_UPLOADED');
    expect(ActivityType.ANALYSIS_CREATED).toBe('ANALYSIS_CREATED');
    expect(ActivityType.ANALYSIS_COMPLETED).toBe('ANALYSIS_COMPLETED');
    expect(ActivityType.REPORT_GENERATED).toBe('REPORT_GENERATED');
    expect(ActivityType.USER_INVITED).toBe('USER_INVITED');
    expect(ActivityType.COMMENT_ADDED).toBe('COMMENT_ADDED');
  });

  it('should have correct enum values for DataType', () => {
    expect(DataType.NUMERIC).toBe('numeric');
    expect(DataType.CATEGORICAL).toBe('categorical');
    expect(DataType.DATE).toBe('date');
    expect(DataType.TEXT).toBe('text');
    expect(DataType.BOOLEAN).toBe('boolean');
  });

  it('should have correct enum values for FilterOperator', () => {
    expect(FilterOperator.EQUALS).toBe('equals');
    expect(FilterOperator.NOT_EQUALS).toBe('not_equals');
    expect(FilterOperator.GREATER_THAN).toBe('greater_than');
    expect(FilterOperator.LESS_THAN).toBe('less_than');
    expect(FilterOperator.CONTAINS).toBe('contains');
    expect(FilterOperator.IS_NULL).toBe('is_null');
    expect(FilterOperator.IN).toBe('in');
  });

  it('should have correct enum values for PreprocessingType', () => {
    expect(PreprocessingType.REMOVE_DUPLICATES).toBe('remove_duplicates');
    expect(PreprocessingType.HANDLE_MISSING).toBe('handle_missing');
    expect(PreprocessingType.CONVERT_TYPE).toBe('convert_type');
    expect(PreprocessingType.FILTER_ROWS).toBe('filter_rows');
    expect(PreprocessingType.CREATE_VARIABLE).toBe('create_variable');
    expect(PreprocessingType.REMOVE_OUTLIERS).toBe('remove_outliers');
  });

  it('should have correct enum values for ReportSectionType', () => {
    expect(ReportSectionType.TEXT).toBe('text');
    expect(ReportSectionType.ANALYSIS).toBe('analysis');
    expect(ReportSectionType.VISUALIZATION).toBe('visualization');
    expect(ReportSectionType.TABLE).toBe('table');
    expect(ReportSectionType.CODE).toBe('code');
    expect(ReportSectionType.PAGE_BREAK).toBe('page_break');
  });

  it('should create valid dataset metadata structure', () => {
    const metadata = {
      columns: [
        {
          name: 'age',
          dataType: DataType.NUMERIC,
          missingValues: 0,
          uniqueValues: 50,
          statistics: {
            mean: 35.5,
            median: 34,
            standardDeviation: 12.3,
            min: 18,
            max: 65,
            count: 100,
            nullCount: 0
          }
        }
      ],
      rowCount: 100,
      fileType: 'csv' as const,
      hasHeader: true,
      importedAt: new Date(),
      originalFileName: 'test_data.csv'
    };

    expect(metadata.columns).toHaveLength(1);
    expect(metadata.columns[0].dataType).toBe(DataType.NUMERIC);
    expect(metadata.rowCount).toBe(100);
    expect(metadata.fileType).toBe('csv');
  });

  it('should create valid analysis parameters structure', () => {
    const parameters = {
      variables: ['age', 'score'],
      options: { confidenceLevel: 0.95 },
      filters: [
        {
          column: 'age',
          operator: FilterOperator.GREATER_THAN,
          value: 18,
          logicalOperator: 'AND' as const
        }
      ],
      alpha: 0.05
    };

    expect(parameters.variables).toContain('age');
    expect(parameters.variables).toContain('score');
    expect(parameters.options.confidenceLevel).toBe(0.95);
    expect(parameters.filters?.[0].operator).toBe(FilterOperator.GREATER_THAN);
  });

  it('should create valid visualization config structure', () => {
    const config = {
      chartType: 'scatter',
      data: {
        x: 'variable1',
        y: 'variable2',
        color: 'category'
      },
      styling: {
        title: 'Scatter Plot',
        xLabel: 'X Variable',
        yLabel: 'Y Variable',
        colors: ['#1f77b4', '#ff7f0e'],
        width: 800,
        height: 600
      },
      interactivity: {
        tooltip: true,
        zoom: true,
        hover: true
      },
      layout: {
        showLegend: true,
        legendPosition: 'right' as const
      }
    };

    expect(config.chartType).toBe('scatter');
    expect(config.data.x).toBe('variable1');
    expect(config.styling.title).toBe('Scatter Plot');
    expect(config.interactivity.tooltip).toBe(true);
    expect(config.layout?.showLegend).toBe(true);
  });

  it('should create valid report content structure', () => {
    const content = {
      sections: [
        {
          id: 'section-1',
          type: ReportSectionType.TEXT,
          title: 'Introduction',
          content: 'This is the introduction section.',
          order: 1
        },
        {
          id: 'section-2',
          type: ReportSectionType.ANALYSIS,
          title: 'Statistical Analysis',
          content: { analysisId: 'analysis-123' },
          order: 2
        }
      ],
      metadata: {
        author: 'Test Author',
        createdAt: new Date(),
        lastModified: new Date(),
        version: 1
      },
      styling: {
        theme: 'default',
        fontSize: 12,
        fontFamily: 'Arial',
        pageSize: 'A4' as const
      }
    };

    expect(content.sections).toHaveLength(2);
    expect(content.sections[0].type).toBe(ReportSectionType.TEXT);
    expect(content.sections[1].type).toBe(ReportSectionType.ANALYSIS);
    expect(content.metadata.version).toBe(1);
    expect(content.styling.pageSize).toBe('A4');
  });
});