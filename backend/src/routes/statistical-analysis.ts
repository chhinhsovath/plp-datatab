import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { StatisticalAnalysisService } from '../lib/statistical-analysis.js';
import { authenticateToken } from '../lib/auth.js';
import { DatabaseService } from '../lib/database.js';
import { AnalysisType } from '../types/database.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * Calculate descriptive statistics for a dataset column
 */
router.post('/descriptive/:datasetId/:columnName',
  param('datasetId').isUUID(),
  param('columnName').isString().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { datasetId, columnName } = req.params;
      const userId = req.user!.id;

      // Get dataset and verify ownership
      const dataset = await DatabaseService.getDataset(datasetId, userId);
      if (!dataset) {
        return res.status(404).json({ error: 'Dataset not found' });
      }

      // Get column data
      const columnData = await DatabaseService.getColumnData(datasetId, columnName);
      if (!columnData) {
        return res.status(404).json({ error: 'Column not found' });
      }

      // Calculate descriptive statistics
      const stats = StatisticalAnalysisService.calculateDescriptiveStats(columnData);

      // Save analysis result
      const analysis = await DatabaseService.createAnalysis({
        name: `Descriptive Statistics - ${columnName}`,
        type: AnalysisType.DESCRIPTIVE,
        datasetId,
        projectId: dataset.projectId,
        userId,
        parameters: { column: columnName },
        results: {
          statistics: stats,
          interpretation: `Descriptive statistics for ${columnName}`,
          assumptions: [],
          summary: `Analyzed ${stats.count} valid observations with ${stats.nullCount} missing values.`
        }
      });

      res.json({
        analysisId: analysis.id,
        statistics: stats
      });
    } catch (error) {
      console.error('Error calculating descriptive statistics:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * Perform frequency analysis for a dataset column
 */
router.post('/frequency/:datasetId/:columnName',
  param('datasetId').isUUID(),
  param('columnName').isString().notEmpty(),
  body('binCount').optional().isInt({ min: 1, max: 100 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { datasetId, columnName } = req.params;
      const { binCount } = req.body;
      const userId = req.user!.id;

      // Get dataset and verify ownership
      const dataset = await DatabaseService.getDataset(datasetId, userId);
      if (!dataset) {
        return res.status(404).json({ error: 'Dataset not found' });
      }

      // Get column data
      const columnData = await DatabaseService.getColumnData(datasetId, columnName);
      if (!columnData) {
        return res.status(404).json({ error: 'Column not found' });
      }

      // Perform frequency analysis
      const frequencyResult = StatisticalAnalysisService.performFrequencyAnalysis(columnData, binCount);

      // Save analysis result
      const analysis = await DatabaseService.createAnalysis({
        name: `Frequency Analysis - ${columnName}`,
        type: AnalysisType.FREQUENCY,
        datasetId,
        projectId: dataset.projectId,
        userId,
        parameters: { column: columnName, binCount },
        results: {
          frequencyAnalysis: frequencyResult,
          interpretation: `Frequency analysis for ${columnName}`,
          assumptions: [],
          summary: `Analyzed frequency distribution with ${Object.keys(frequencyResult.frequencies).length} unique values.`
        }
      });

      res.json({
        analysisId: analysis.id,
        frequencyAnalysis: frequencyResult
      });
    } catch (error) {
      console.error('Error performing frequency analysis:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * Calculate correlation matrix for multiple columns
 */
router.post('/correlation/:datasetId',
  param('datasetId').isUUID(),
  body('columns').isArray({ min: 2 }),
  body('columns.*').isString().notEmpty(),
  body('method').optional().isIn(['pearson', 'spearman']),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { datasetId } = req.params;
      const { columns, method = 'pearson' } = req.body;
      const userId = req.user!.id;

      // Get dataset and verify ownership
      const dataset = await DatabaseService.getDataset(datasetId, userId);
      if (!dataset) {
        return res.status(404).json({ error: 'Dataset not found' });
      }

      // Get data for all columns
      const columnData: { [key: string]: number[] } = {};
      for (const columnName of columns) {
        const data = await DatabaseService.getColumnData(datasetId, columnName);
        if (!data) {
          return res.status(404).json({ error: `Column ${columnName} not found` });
        }
        columnData[columnName] = data;
      }

      // Calculate correlation matrix
      const correlationMatrix = StatisticalAnalysisService.calculateCorrelationMatrix(columnData, method);

      // Save analysis result
      const analysis = await DatabaseService.createAnalysis({
        name: `Correlation Analysis - ${columns.join(', ')}`,
        type: AnalysisType.CORRELATION,
        datasetId,
        projectId: dataset.projectId,
        userId,
        parameters: { columns, method },
        results: {
          correlationMatrix,
          interpretation: `${method} correlation analysis for ${columns.length} variables`,
          assumptions: [],
          summary: `Calculated ${method} correlation matrix for ${columns.length} variables.`
        }
      });

      res.json({
        analysisId: analysis.id,
        correlationMatrix
      });
    } catch (error) {
      console.error('Error calculating correlation matrix:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * Perform normality tests on a dataset column
 */
router.post('/normality/:datasetId/:columnName',
  param('datasetId').isUUID(),
  param('columnName').isString().notEmpty(),
  body('tests').optional().isArray(),
  body('tests.*').optional().isIn(['shapiro-wilk', 'kolmogorov-smirnov']),
  body('alpha').optional().isFloat({ min: 0.001, max: 0.1 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { datasetId, columnName } = req.params;
      const { tests = ['shapiro-wilk', 'kolmogorov-smirnov'], alpha = 0.05 } = req.body;
      const userId = req.user!.id;

      // Get dataset and verify ownership
      const dataset = await DatabaseService.getDataset(datasetId, userId);
      if (!dataset) {
        return res.status(404).json({ error: 'Dataset not found' });
      }

      // Get column data
      const columnData = await DatabaseService.getColumnData(datasetId, columnName);
      if (!columnData) {
        return res.status(404).json({ error: 'Column not found' });
      }

      // Filter numeric data
      const numericData = columnData.filter(val => typeof val === 'number' && !isNaN(val));
      if (numericData.length === 0) {
        return res.status(400).json({ error: 'Column contains no numeric data' });
      }

      // Perform normality tests
      const testResults = [];
      
      if (tests.includes('shapiro-wilk')) {
        try {
          const shapiroResult = StatisticalAnalysisService.shapiroWilkTest(numericData, alpha);
          testResults.push(shapiroResult);
        } catch (error) {
          testResults.push({
            testName: 'Shapiro-Wilk',
            error: (error as Error).message
          });
        }
      }

      if (tests.includes('kolmogorov-smirnov')) {
        try {
          const ksResult = StatisticalAnalysisService.kolmogorovSmirnovTest(numericData, alpha);
          testResults.push(ksResult);
        } catch (error) {
          testResults.push({
            testName: 'Kolmogorov-Smirnov',
            error: (error as Error).message
          });
        }
      }

      // Save analysis result
      const analysis = await DatabaseService.createAnalysis({
        name: `Normality Tests - ${columnName}`,
        type: AnalysisType.NORMALITY,
        datasetId,
        projectId: dataset.projectId,
        userId,
        parameters: { column: columnName, tests, alpha },
        results: {
          normalityTests: testResults,
          interpretation: `Normality testing for ${columnName}`,
          assumptions: [],
          summary: `Performed ${testResults.length} normality tests on ${numericData.length} observations.`
        }
      });

      res.json({
        analysisId: analysis.id,
        normalityTests: testResults
      });
    } catch (error) {
      console.error('Error performing normality tests:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * Create contingency table and perform chi-square test
 */
router.post('/contingency/:datasetId',
  param('datasetId').isUUID(),
  body('rowVariable').isString().notEmpty(),
  body('columnVariable').isString().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { datasetId } = req.params;
      const { rowVariable, columnVariable } = req.body;
      const userId = req.user!.id;

      // Get dataset and verify ownership
      const dataset = await DatabaseService.getDataset(datasetId, userId);
      if (!dataset) {
        return res.status(404).json({ error: 'Dataset not found' });
      }

      // Get data for both variables
      const rowData = await DatabaseService.getColumnData(datasetId, rowVariable);
      const columnData = await DatabaseService.getColumnData(datasetId, columnVariable);
      
      if (!rowData || !columnData) {
        return res.status(404).json({ error: 'One or both variables not found' });
      }

      // Create contingency table
      const contingencyTable = StatisticalAnalysisService.createContingencyTable(
        rowData, columnData, rowVariable, columnVariable
      );

      // Save analysis result
      const analysis = await DatabaseService.createAnalysis({
        name: `Contingency Table - ${rowVariable} × ${columnVariable}`,
        type: AnalysisType.CROSSTAB,
        datasetId,
        projectId: dataset.projectId,
        userId,
        parameters: { rowVariable, columnVariable },
        results: {
          contingencyTable,
          interpretation: `Cross-tabulation analysis between ${rowVariable} and ${columnVariable}`,
          assumptions: [],
          summary: `Created ${contingencyTable.rowLabels.length}×${contingencyTable.columnLabels.length} contingency table with chi-square test.`
        }
      });

      res.json({
        analysisId: analysis.id,
        contingencyTable
      });
    } catch (error) {
      console.error('Error creating contingency table:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * Perform t-tests (one-sample, independent, paired)
 */
router.post('/t-test/:datasetId',
  param('datasetId').isUUID(),
  body('testType').isIn(['one-sample', 'independent', 'paired']),
  body('variable1').isString().notEmpty(),
  body('variable2').optional().isString(),
  body('populationMean').optional().isNumeric(),
  body('equalVariances').optional().isBoolean(),
  body('alpha').optional().isFloat({ min: 0.001, max: 0.1 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { datasetId } = req.params;
      const { testType, variable1, variable2, populationMean, equalVariances = true, alpha = 0.05 } = req.body;
      const userId = req.user!.id;

      // Get dataset and verify ownership
      const dataset = await DatabaseService.getDataset(datasetId, userId);
      if (!dataset) {
        return res.status(404).json({ error: 'Dataset not found' });
      }

      // Get data for variable(s)
      const data1 = await DatabaseService.getColumnData(datasetId, variable1);
      if (!data1) {
        return res.status(404).json({ error: `Variable ${variable1} not found` });
      }

      let result;
      let analysisName;

      if (testType === 'one-sample') {
        if (populationMean === undefined) {
          return res.status(400).json({ error: 'Population mean is required for one-sample t-test' });
        }
        result = StatisticalAnalysisService.oneSampleTTest(data1, populationMean, alpha);
        analysisName = `One-Sample t-test - ${variable1}`;
      } else if (testType === 'independent') {
        if (!variable2) {
          return res.status(400).json({ error: 'Second variable is required for independent t-test' });
        }
        const data2 = await DatabaseService.getColumnData(datasetId, variable2);
        if (!data2) {
          return res.status(404).json({ error: `Variable ${variable2} not found` });
        }
        result = StatisticalAnalysisService.independentTTest(data1, data2, equalVariances, alpha);
        analysisName = `Independent t-test - ${variable1} vs ${variable2}`;
      } else { // paired
        if (!variable2) {
          return res.status(400).json({ error: 'Second variable is required for paired t-test' });
        }
        const data2 = await DatabaseService.getColumnData(datasetId, variable2);
        if (!data2) {
          return res.status(404).json({ error: `Variable ${variable2} not found` });
        }
        result = StatisticalAnalysisService.pairedTTest(data1, data2, alpha);
        analysisName = `Paired t-test - ${variable1} vs ${variable2}`;
      }

      // Save analysis result
      const analysis = await DatabaseService.createAnalysis({
        name: analysisName,
        type: AnalysisType.TTEST,
        datasetId,
        projectId: dataset.projectId,
        userId,
        parameters: { testType, variable1, variable2, populationMean, equalVariances, alpha },
        results: {
          tTestResult: result,
          interpretation: `${testType} t-test analysis`,
          assumptions: result.assumptions,
          summary: `Performed ${testType} t-test with ${result.degreesOfFreedom} degrees of freedom.`
        }
      });

      res.json({
        analysisId: analysis.id,
        tTestResult: result
      });
    } catch (error) {
      console.error('Error performing t-test:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }
);

/**
 * Perform one-way ANOVA
 */
router.post('/anova/:datasetId',
  param('datasetId').isUUID(),
  body('dependentVariable').isString().notEmpty(),
  body('groupingVariable').isString().notEmpty(),
  body('alpha').optional().isFloat({ min: 0.001, max: 0.1 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { datasetId } = req.params;
      const { dependentVariable, groupingVariable, alpha = 0.05 } = req.body;
      const userId = req.user!.id;

      // Get dataset and verify ownership
      const dataset = await DatabaseService.getDataset(datasetId, userId);
      if (!dataset) {
        return res.status(404).json({ error: 'Dataset not found' });
      }

      // Get data for both variables
      const dependentData = await DatabaseService.getColumnData(datasetId, dependentVariable);
      const groupingData = await DatabaseService.getColumnData(datasetId, groupingVariable);
      
      if (!dependentData || !groupingData) {
        return res.status(404).json({ error: 'One or both variables not found' });
      }

      // Group data by grouping variable
      const groups: { [key: string]: number[] } = {};
      for (let i = 0; i < dependentData.length; i++) {
        if (dependentData[i] !== null && dependentData[i] !== undefined && !isNaN(dependentData[i]) &&
            groupingData[i] !== null && groupingData[i] !== undefined) {
          const groupKey = String(groupingData[i]);
          if (!groups[groupKey]) {
            groups[groupKey] = [];
          }
          groups[groupKey].push(dependentData[i]);
        }
      }

      // Perform ANOVA
      const result = StatisticalAnalysisService.oneWayANOVA(groups, alpha);

      // Save analysis result
      const analysis = await DatabaseService.createAnalysis({
        name: `One-Way ANOVA - ${dependentVariable} by ${groupingVariable}`,
        type: AnalysisType.ANOVA,
        datasetId,
        projectId: dataset.projectId,
        userId,
        parameters: { dependentVariable, groupingVariable, alpha },
        results: {
          anovaResult: result,
          interpretation: `One-way ANOVA analysis of ${dependentVariable} by ${groupingVariable}`,
          assumptions: result.assumptions,
          summary: `Performed ANOVA with ${result.groups.length} groups and ${result.degreesOfFreedomWithin} error degrees of freedom.`
        }
      });

      res.json({
        analysisId: analysis.id,
        anovaResult: result
      });
    } catch (error) {
      console.error('Error performing ANOVA:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }
);

/**
 * Perform linear regression
 */
router.post('/regression/:datasetId',
  param('datasetId').isUUID(),
  body('dependentVariable').isString().notEmpty(),
  body('independentVariable').isString().notEmpty(),
  body('alpha').optional().isFloat({ min: 0.001, max: 0.1 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { datasetId } = req.params;
      const { dependentVariable, independentVariable, alpha = 0.05 } = req.body;
      const userId = req.user!.id;

      // Get dataset and verify ownership
      const dataset = await DatabaseService.getDataset(datasetId, userId);
      if (!dataset) {
        return res.status(404).json({ error: 'Dataset not found' });
      }

      // Get data for both variables
      const yData = await DatabaseService.getColumnData(datasetId, dependentVariable);
      const xData = await DatabaseService.getColumnData(datasetId, independentVariable);
      
      if (!yData || !xData) {
        return res.status(404).json({ error: 'One or both variables not found' });
      }

      // Perform linear regression
      const result = StatisticalAnalysisService.linearRegression(xData, yData, alpha);

      // Save analysis result
      const analysis = await DatabaseService.createAnalysis({
        name: `Linear Regression - ${dependentVariable} ~ ${independentVariable}`,
        type: AnalysisType.REGRESSION,
        datasetId,
        projectId: dataset.projectId,
        userId,
        parameters: { dependentVariable, independentVariable, alpha },
        results: {
          regressionResult: result,
          interpretation: `Linear regression analysis of ${dependentVariable} on ${independentVariable}`,
          assumptions: result.assumptions,
          summary: `Performed linear regression with R² = ${result.rSquared.toFixed(4)}.`
        }
      });

      res.json({
        analysisId: analysis.id,
        regressionResult: result
      });
    } catch (error) {
      console.error('Error performing regression:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }
);

/**
 * Perform non-parametric tests
 */
router.post('/nonparametric/:datasetId',
  param('datasetId').isUUID(),
  body('testType').isIn(['mann-whitney', 'wilcoxon', 'kruskal-wallis']),
  body('variable1').isString().notEmpty(),
  body('variable2').optional().isString(),
  body('groupingVariable').optional().isString(),
  body('alpha').optional().isFloat({ min: 0.001, max: 0.1 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { datasetId } = req.params;
      const { testType, variable1, variable2, groupingVariable, alpha = 0.05 } = req.body;
      const userId = req.user!.id;

      // Get dataset and verify ownership
      const dataset = await DatabaseService.getDataset(datasetId, userId);
      if (!dataset) {
        return res.status(404).json({ error: 'Dataset not found' });
      }

      // Get data for variable(s)
      const data1 = await DatabaseService.getColumnData(datasetId, variable1);
      if (!data1) {
        return res.status(404).json({ error: `Variable ${variable1} not found` });
      }

      let result;
      let analysisName;

      if (testType === 'mann-whitney') {
        if (!variable2) {
          return res.status(400).json({ error: 'Second variable is required for Mann-Whitney U test' });
        }
        const data2 = await DatabaseService.getColumnData(datasetId, variable2);
        if (!data2) {
          return res.status(404).json({ error: `Variable ${variable2} not found` });
        }
        result = StatisticalAnalysisService.mannWhitneyUTest(data1, data2, alpha);
        analysisName = `Mann-Whitney U Test - ${variable1} vs ${variable2}`;
      } else if (testType === 'wilcoxon') {
        if (!variable2) {
          return res.status(400).json({ error: 'Second variable is required for Wilcoxon signed-rank test' });
        }
        const data2 = await DatabaseService.getColumnData(datasetId, variable2);
        if (!data2) {
          return res.status(404).json({ error: `Variable ${variable2} not found` });
        }
        result = StatisticalAnalysisService.wilcoxonSignedRankTest(data1, data2, alpha);
        analysisName = `Wilcoxon Signed-Rank Test - ${variable1} vs ${variable2}`;
      } else { // kruskal-wallis
        if (!groupingVariable) {
          return res.status(400).json({ error: 'Grouping variable is required for Kruskal-Wallis test' });
        }
        const groupingData = await DatabaseService.getColumnData(datasetId, groupingVariable);
        if (!groupingData) {
          return res.status(404).json({ error: `Grouping variable ${groupingVariable} not found` });
        }

        // Group data by grouping variable
        const groups: { [key: string]: number[] } = {};
        for (let i = 0; i < data1.length; i++) {
          if (data1[i] !== null && data1[i] !== undefined && !isNaN(data1[i]) &&
              groupingData[i] !== null && groupingData[i] !== undefined) {
            const groupKey = String(groupingData[i]);
            if (!groups[groupKey]) {
              groups[groupKey] = [];
            }
            groups[groupKey].push(data1[i]);
          }
        }

        result = StatisticalAnalysisService.kruskalWallisTest(groups, alpha);
        analysisName = `Kruskal-Wallis Test - ${variable1} by ${groupingVariable}`;
      }

      // Save analysis result
      const analysis = await DatabaseService.createAnalysis({
        name: analysisName,
        type: AnalysisType.NONPARAMETRIC,
        datasetId,
        projectId: dataset.projectId,
        userId,
        parameters: { testType, variable1, variable2, groupingVariable, alpha },
        results: {
          nonParametricResult: result,
          interpretation: `${testType} non-parametric test analysis`,
          assumptions: [],
          summary: `Performed ${testType} test with p-value = ${result.pValue.toFixed(4)}.`
        }
      });

      res.json({
        analysisId: analysis.id,
        nonParametricResult: result
      });
    } catch (error) {
      console.error('Error performing non-parametric test:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }
);

/**
 * Get test suggestions based on data characteristics
 */
router.post('/suggest-tests/:datasetId',
  param('datasetId').isUUID(),
  body('variables').isArray({ min: 1 }),
  body('variables.*').isString().notEmpty(),
  body('numGroups').optional().isInt({ min: 2 }),
  body('pairedData').optional().isBoolean(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { datasetId } = req.params;
      const { variables, numGroups, pairedData } = req.body;
      const userId = req.user!.id;

      // Get dataset and verify ownership
      const dataset = await DatabaseService.getDataset(datasetId, userId);
      if (!dataset) {
        return res.status(404).json({ error: 'Dataset not found' });
      }

      // Get metadata for each variable to determine data types and sample sizes
      const dataTypes: { [variable: string]: 'numeric' | 'categorical' } = {};
      const sampleSizes: { [variable: string]: number } = {};

      for (const variable of variables) {
        const columnData = await DatabaseService.getColumnData(datasetId, variable);
        if (!columnData) {
          return res.status(404).json({ error: `Variable ${variable} not found` });
        }

        // Determine data type (simplified heuristic)
        const numericCount = columnData.filter(val => typeof val === 'number' && !isNaN(val)).length;
        const totalCount = columnData.filter(val => val !== null && val !== undefined).length;
        
        dataTypes[variable] = numericCount / totalCount > 0.8 ? 'numeric' : 'categorical';
        sampleSizes[variable] = totalCount;
      }

      // Get test suggestions
      const suggestions = StatisticalAnalysisService.suggestTests(dataTypes, sampleSizes, numGroups, pairedData);

      res.json({
        suggestions,
        dataTypes,
        sampleSizes
      });
    } catch (error) {
      console.error('Error getting test suggestions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;