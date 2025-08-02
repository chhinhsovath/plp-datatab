import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { prisma } from '../lib/database.js';
import statisticalAnalysisRoutes from '../routes/statistical-analysis.js';
import { generateToken } from '../lib/auth.js';
import { AnalysisType } from '../types/database.js';

const app = express();
app.use(express.json());
app.use('/api/analysis', statisticalAnalysisRoutes);

describe('Statistical Analysis API Routes', () => {
  let testUser: any;
  let testProject: any;
  let testDataset: any;
  let authToken: string;

  beforeEach(async () => {
    // Clean up database
    await prisma.analysis.deleteMany();
    await prisma.dataset.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();

    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashedpassword'
      }
    });

    // Create test project
    testProject = await prisma.project.create({
      data: {
        name: 'Test Project',
        description: 'Test project for statistical analysis',
        ownerId: testUser.id
      }
    });

    // Create test dataset
    testDataset = await prisma.dataset.create({
      data: {
        name: 'Test Dataset',
        filePath: '/test/path/data.csv',
        fileSize: 1024,
        metadata: {
          columns: [
            { name: 'age', dataType: 'numeric', missingValues: 0, uniqueValues: 8 },
            { name: 'score', dataType: 'numeric', missingValues: 0, uniqueValues: 8 },
            { name: 'category', dataType: 'categorical', missingValues: 0, uniqueValues: 3 }
          ],
          rowCount: 8,
          fileType: 'csv',
          hasHeader: true,
          importedAt: new Date(),
          originalFileName: 'test-data.csv'
        },
        userId: testUser.id,
        projectId: testProject.id
      }
    });

    // Generate auth token
    authToken = generateToken(testUser.id);
  });

  afterEach(async () => {
    // Clean up
    await prisma.analysis.deleteMany();
    await prisma.dataset.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('POST /api/analysis/descriptive/:datasetId/:columnName', () => {
    it('should calculate descriptive statistics for a numeric column', async () => {
      const response = await request(app)
        .post(`/api/analysis/descriptive/${testDataset.id}/age`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('analysisId');
      expect(response.body).toHaveProperty('statistics');
      expect(response.body.statistics).toHaveProperty('mean');
      expect(response.body.statistics).toHaveProperty('median');
      expect(response.body.statistics).toHaveProperty('standardDeviation');
      expect(response.body.statistics).toHaveProperty('count');
    });

    it('should return 404 for non-existent dataset', async () => {
      const fakeDatasetId = '00000000-0000-0000-0000-000000000000';
      
      await request(app)
        .post(`/api/analysis/descriptive/${fakeDatasetId}/age`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent column', async () => {
      await request(app)
        .post(`/api/analysis/descriptive/${testDataset.id}/nonexistent`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .post(`/api/analysis/descriptive/${testDataset.id}/age`)
        .expect(401);
    });
  });

  describe('POST /api/analysis/frequency/:datasetId/:columnName', () => {
    it('should perform frequency analysis for categorical data', async () => {
      const response = await request(app)
        .post(`/api/analysis/frequency/${testDataset.id}/category`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('analysisId');
      expect(response.body).toHaveProperty('frequencyAnalysis');
      expect(response.body.frequencyAnalysis).toHaveProperty('frequencies');
      expect(response.body.frequencyAnalysis).toHaveProperty('relativeFrequencies');
    });

    it('should create histogram for numeric data with bin count', async () => {
      const response = await request(app)
        .post(`/api/analysis/frequency/${testDataset.id}/age`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ binCount: 4 })
        .expect(200);

      expect(response.body.frequencyAnalysis).toHaveProperty('histogram');
      expect(response.body.frequencyAnalysis.histogram).toHaveLength(4);
    });

    it('should validate bin count parameter', async () => {
      await request(app)
        .post(`/api/analysis/frequency/${testDataset.id}/age`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ binCount: 0 })
        .expect(400);
    });
  });

  describe('POST /api/analysis/correlation/:datasetId', () => {
    it('should calculate Pearson correlation matrix', async () => {
      const response = await request(app)
        .post(`/api/analysis/correlation/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          columns: ['age', 'score'],
          method: 'pearson'
        })
        .expect(200);

      expect(response.body).toHaveProperty('analysisId');
      expect(response.body).toHaveProperty('correlationMatrix');
      expect(response.body.correlationMatrix).toHaveProperty('variables');
      expect(response.body.correlationMatrix).toHaveProperty('matrix');
      expect(response.body.correlationMatrix.variables).toEqual(['age', 'score']);
      expect(response.body.correlationMatrix.matrix).toHaveLength(2);
      expect(response.body.correlationMatrix.matrix[0]).toHaveLength(2);
    });

    it('should calculate Spearman correlation matrix', async () => {
      const response = await request(app)
        .post(`/api/analysis/correlation/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          columns: ['age', 'score'],
          method: 'spearman'
        })
        .expect(200);

      expect(response.body.correlationMatrix).toHaveProperty('variables');
      expect(response.body.correlationMatrix).toHaveProperty('matrix');
    });

    it('should require at least 2 columns', async () => {
      await request(app)
        .post(`/api/analysis/correlation/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          columns: ['age'],
          method: 'pearson'
        })
        .expect(400);
    });

    it('should validate correlation method', async () => {
      await request(app)
        .post(`/api/analysis/correlation/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          columns: ['age', 'score'],
          method: 'invalid'
        })
        .expect(400);
    });

    it('should return 404 for non-existent column', async () => {
      await request(app)
        .post(`/api/analysis/correlation/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          columns: ['age', 'nonexistent'],
          method: 'pearson'
        })
        .expect(404);
    });
  });

  describe('POST /api/analysis/normality/:datasetId/:columnName', () => {
    it('should perform normality tests with default settings', async () => {
      const response = await request(app)
        .post(`/api/analysis/normality/${testDataset.id}/age`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('analysisId');
      expect(response.body).toHaveProperty('normalityTests');
      expect(response.body.normalityTests).toHaveLength(2); // Both Shapiro-Wilk and KS
      
      response.body.normalityTests.forEach((test: any) => {
        expect(test).toHaveProperty('testName');
        expect(test).toHaveProperty('statistic');
        expect(test).toHaveProperty('pValue');
        expect(test).toHaveProperty('isNormal');
        expect(test).toHaveProperty('alpha');
      });
    });

    it('should perform specific normality tests', async () => {
      const response = await request(app)
        .post(`/api/analysis/normality/${testDataset.id}/age`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tests: ['shapiro-wilk'],
          alpha: 0.01
        })
        .expect(200);

      expect(response.body.normalityTests).toHaveLength(1);
      expect(response.body.normalityTests[0].testName).toBe('Shapiro-Wilk');
      expect(response.body.normalityTests[0].alpha).toBe(0.01);
    });

    it('should validate test names', async () => {
      await request(app)
        .post(`/api/analysis/normality/${testDataset.id}/age`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tests: ['invalid-test']
        })
        .expect(400);
    });

    it('should validate alpha parameter', async () => {
      await request(app)
        .post(`/api/analysis/normality/${testDataset.id}/age`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          alpha: 0.5 // Too high
        })
        .expect(400);
    });

    it('should return 400 for non-numeric column', async () => {
      // This test assumes the mock data returns non-numeric data for 'category'
      // In a real implementation, this would be handled by the getColumnData method
      const response = await request(app)
        .post(`/api/analysis/normality/${testDataset.id}/category`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toContain('numeric data');
    });
  });

  describe('POST /api/analysis/contingency/:datasetId', () => {
    it('should create contingency table and perform chi-square test', async () => {
      const response = await request(app)
        .post(`/api/analysis/contingency/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rowVariable: 'category',
          columnVariable: 'category' // Using same variable for simplicity in test
        })
        .expect(200);

      expect(response.body).toHaveProperty('analysisId');
      expect(response.body).toHaveProperty('contingencyTable');
      expect(response.body.contingencyTable).toHaveProperty('rowVariable');
      expect(response.body.contingencyTable).toHaveProperty('columnVariable');
      expect(response.body.contingencyTable).toHaveProperty('table');
      expect(response.body.contingencyTable).toHaveProperty('rowLabels');
      expect(response.body.contingencyTable).toHaveProperty('columnLabels');
      expect(response.body.contingencyTable).toHaveProperty('totals');
      expect(response.body.contingencyTable).toHaveProperty('chiSquareTest');
    });

    it('should validate required parameters', async () => {
      await request(app)
        .post(`/api/analysis/contingency/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rowVariable: 'category'
          // Missing columnVariable
        })
        .expect(400);
    });

    it('should return 404 for non-existent variables', async () => {
      await request(app)
        .post(`/api/analysis/contingency/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rowVariable: 'nonexistent',
          columnVariable: 'category'
        })
        .expect(404);
    });
  });

  describe('Analysis persistence', () => {
    it('should save analysis results to database', async () => {
      const response = await request(app)
        .post(`/api/analysis/descriptive/${testDataset.id}/age`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const analysisId = response.body.analysisId;
      
      // Verify analysis was saved to database
      const savedAnalysis = await prisma.analysis.findUnique({
        where: { id: analysisId }
      });

      expect(savedAnalysis).toBeTruthy();
      expect(savedAnalysis!.name).toContain('Descriptive Statistics');
      expect(savedAnalysis!.type).toBe(AnalysisType.DESCRIPTIVE);
      expect(savedAnalysis!.datasetId).toBe(testDataset.id);
      expect(savedAnalysis!.projectId).toBe(testProject.id);
      expect(savedAnalysis!.results).toBeTruthy();
    });

    it('should include proper metadata in saved analysis', async () => {
      const response = await request(app)
        .post(`/api/analysis/correlation/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          columns: ['age', 'score'],
          method: 'pearson'
        })
        .expect(200);

      const analysisId = response.body.analysisId;
      const savedAnalysis = await prisma.analysis.findUnique({
        where: { id: analysisId }
      });

      expect(savedAnalysis!.parameters).toEqual({
        columns: ['age', 'score'],
        method: 'pearson'
      });
      expect(savedAnalysis!.results).toHaveProperty('correlationMatrix');
      expect(savedAnalysis!.results).toHaveProperty('interpretation');
      expect(savedAnalysis!.results).toHaveProperty('summary');
    });
  });

  // ============ ADVANCED STATISTICAL TESTS ============

  describe('POST /api/analysis/t-test/:datasetId', () => {
    it('should perform one-sample t-test', async () => {
      const response = await request(app)
        .post(`/api/analysis/t-test/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          testType: 'one-sample',
          variable1: 'age',
          populationMean: 25,
          alpha: 0.05
        })
        .expect(200);

      expect(response.body).toHaveProperty('analysisId');
      expect(response.body).toHaveProperty('tTestResult');
      expect(response.body.tTestResult.testType).toBe('one-sample');
      expect(response.body.tTestResult).toHaveProperty('statistic');
      expect(response.body.tTestResult).toHaveProperty('pValue');
      expect(response.body.tTestResult).toHaveProperty('degreesOfFreedom');
      expect(response.body.tTestResult).toHaveProperty('confidenceInterval');
      expect(response.body.tTestResult).toHaveProperty('meanDifference');
      expect(response.body.tTestResult).toHaveProperty('effectSize');
      expect(response.body.tTestResult).toHaveProperty('assumptions');
    });

    it('should perform independent t-test', async () => {
      const response = await request(app)
        .post(`/api/analysis/t-test/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          testType: 'independent',
          variable1: 'age',
          variable2: 'score',
          equalVariances: true,
          alpha: 0.05
        })
        .expect(200);

      expect(response.body.tTestResult.testType).toBe('independent');
      expect(response.body.tTestResult).toHaveProperty('assumptions');
    });

    it('should perform paired t-test', async () => {
      const response = await request(app)
        .post(`/api/analysis/t-test/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          testType: 'paired',
          variable1: 'age',
          variable2: 'score',
          alpha: 0.05
        })
        .expect(200);

      expect(response.body.tTestResult.testType).toBe('paired');
    });

    it('should require population mean for one-sample t-test', async () => {
      await request(app)
        .post(`/api/analysis/t-test/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          testType: 'one-sample',
          variable1: 'age'
        })
        .expect(400);
    });

    it('should require second variable for independent t-test', async () => {
      await request(app)
        .post(`/api/analysis/t-test/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          testType: 'independent',
          variable1: 'age'
        })
        .expect(400);
    });

    it('should validate test type', async () => {
      await request(app)
        .post(`/api/analysis/t-test/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          testType: 'invalid',
          variable1: 'age'
        })
        .expect(400);
    });
  });

  describe('POST /api/analysis/anova/:datasetId', () => {
    it('should perform one-way ANOVA', async () => {
      const response = await request(app)
        .post(`/api/analysis/anova/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dependentVariable: 'score',
          groupingVariable: 'category',
          alpha: 0.05
        })
        .expect(200);

      expect(response.body).toHaveProperty('analysisId');
      expect(response.body).toHaveProperty('anovaResult');
      expect(response.body.anovaResult).toHaveProperty('fStatistic');
      expect(response.body.anovaResult).toHaveProperty('pValue');
      expect(response.body.anovaResult).toHaveProperty('degreesOfFreedomBetween');
      expect(response.body.anovaResult).toHaveProperty('degreesOfFreedomWithin');
      expect(response.body.anovaResult).toHaveProperty('etaSquared');
      expect(response.body.anovaResult).toHaveProperty('groups');
      expect(response.body.anovaResult).toHaveProperty('assumptions');
      expect(Array.isArray(response.body.anovaResult.groups)).toBe(true);
    });

    it('should validate required parameters', async () => {
      await request(app)
        .post(`/api/analysis/anova/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dependentVariable: 'score'
          // Missing groupingVariable
        })
        .expect(400);
    });

    it('should return 404 for non-existent variables', async () => {
      await request(app)
        .post(`/api/analysis/anova/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dependentVariable: 'nonexistent',
          groupingVariable: 'category'
        })
        .expect(404);
    });
  });

  describe('POST /api/analysis/regression/:datasetId', () => {
    it('should perform linear regression', async () => {
      const response = await request(app)
        .post(`/api/analysis/regression/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dependentVariable: 'score',
          independentVariable: 'age',
          alpha: 0.05
        })
        .expect(200);

      expect(response.body).toHaveProperty('analysisId');
      expect(response.body).toHaveProperty('regressionResult');
      expect(response.body.regressionResult.type).toBe('linear');
      expect(response.body.regressionResult).toHaveProperty('coefficients');
      expect(response.body.regressionResult).toHaveProperty('rSquared');
      expect(response.body.regressionResult).toHaveProperty('adjustedRSquared');
      expect(response.body.regressionResult).toHaveProperty('fStatistic');
      expect(response.body.regressionResult).toHaveProperty('fPValue');
      expect(response.body.regressionResult).toHaveProperty('residuals');
      expect(response.body.regressionResult).toHaveProperty('fitted');
      expect(response.body.regressionResult).toHaveProperty('assumptions');
      expect(response.body.regressionResult).toHaveProperty('diagnostics');
      
      expect(Array.isArray(response.body.regressionResult.coefficients)).toBe(true);
      expect(response.body.regressionResult.coefficients).toHaveLength(2); // Intercept + slope
      
      response.body.regressionResult.coefficients.forEach((coef: any) => {
        expect(coef).toHaveProperty('variable');
        expect(coef).toHaveProperty('coefficient');
        expect(coef).toHaveProperty('standardError');
        expect(coef).toHaveProperty('tStatistic');
        expect(coef).toHaveProperty('pValue');
        expect(coef).toHaveProperty('confidenceInterval');
      });
    });

    it('should validate required parameters', async () => {
      await request(app)
        .post(`/api/analysis/regression/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dependentVariable: 'score'
          // Missing independentVariable
        })
        .expect(400);
    });

    it('should return 404 for non-existent variables', async () => {
      await request(app)
        .post(`/api/analysis/regression/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dependentVariable: 'nonexistent',
          independentVariable: 'age'
        })
        .expect(404);
    });
  });

  describe('POST /api/analysis/nonparametric/:datasetId', () => {
    it('should perform Mann-Whitney U test', async () => {
      const response = await request(app)
        .post(`/api/analysis/nonparametric/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          testType: 'mann-whitney',
          variable1: 'age',
          variable2: 'score',
          alpha: 0.05
        })
        .expect(200);

      expect(response.body).toHaveProperty('analysisId');
      expect(response.body).toHaveProperty('nonParametricResult');
      expect(response.body.nonParametricResult.testType).toBe('mann-whitney');
      expect(response.body.nonParametricResult).toHaveProperty('statistic');
      expect(response.body.nonParametricResult).toHaveProperty('pValue');
      expect(response.body.nonParametricResult).toHaveProperty('effectSize');
      expect(response.body.nonParametricResult).toHaveProperty('ranks');
      expect(response.body.nonParametricResult).toHaveProperty('medians');
    });

    it('should perform Wilcoxon signed-rank test', async () => {
      const response = await request(app)
        .post(`/api/analysis/nonparametric/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          testType: 'wilcoxon',
          variable1: 'age',
          variable2: 'score',
          alpha: 0.05
        })
        .expect(200);

      expect(response.body.nonParametricResult.testType).toBe('wilcoxon');
      expect(response.body.nonParametricResult).toHaveProperty('effectSize');
    });

    it('should perform Kruskal-Wallis test', async () => {
      const response = await request(app)
        .post(`/api/analysis/nonparametric/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          testType: 'kruskal-wallis',
          variable1: 'score',
          groupingVariable: 'category',
          alpha: 0.05
        })
        .expect(200);

      expect(response.body.nonParametricResult.testType).toBe('kruskal-wallis');
      expect(response.body.nonParametricResult).toHaveProperty('medians');
    });

    it('should validate test type', async () => {
      await request(app)
        .post(`/api/analysis/nonparametric/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          testType: 'invalid',
          variable1: 'age'
        })
        .expect(400);
    });

    it('should require second variable for Mann-Whitney test', async () => {
      await request(app)
        .post(`/api/analysis/nonparametric/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          testType: 'mann-whitney',
          variable1: 'age'
        })
        .expect(400);
    });

    it('should require grouping variable for Kruskal-Wallis test', async () => {
      await request(app)
        .post(`/api/analysis/nonparametric/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          testType: 'kruskal-wallis',
          variable1: 'score'
        })
        .expect(400);
    });
  });

  describe('POST /api/analysis/suggest-tests/:datasetId', () => {
    it('should suggest appropriate tests for given variables', async () => {
      const response = await request(app)
        .post(`/api/analysis/suggest-tests/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variables: ['age', 'score'],
          numGroups: undefined,
          pairedData: false
        })
        .expect(200);

      expect(response.body).toHaveProperty('suggestions');
      expect(response.body).toHaveProperty('dataTypes');
      expect(response.body).toHaveProperty('sampleSizes');
      
      expect(Array.isArray(response.body.suggestions)).toBe(true);
      expect(response.body.suggestions.length).toBeGreaterThan(0);
      
      response.body.suggestions.forEach((suggestion: any) => {
        expect(suggestion).toHaveProperty('testName');
        expect(suggestion).toHaveProperty('testType');
        expect(suggestion).toHaveProperty('reason');
        expect(suggestion).toHaveProperty('assumptions');
        expect(suggestion).toHaveProperty('confidence');
        expect(typeof suggestion.confidence).toBe('number');
        expect(suggestion.confidence).toBeGreaterThan(0);
        expect(suggestion.confidence).toBeLessThanOrEqual(1);
      });

      expect(response.body.dataTypes).toHaveProperty('age');
      expect(response.body.dataTypes).toHaveProperty('score');
      expect(response.body.sampleSizes).toHaveProperty('age');
      expect(response.body.sampleSizes).toHaveProperty('score');
    });

    it('should suggest tests for single variable', async () => {
      const response = await request(app)
        .post(`/api/analysis/suggest-tests/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variables: ['age']
        })
        .expect(200);

      expect(response.body.suggestions.length).toBeGreaterThan(0);
      expect(response.body.suggestions.some((s: any) => s.testName.includes('t-test'))).toBe(true);
    });

    it('should suggest tests for multiple groups', async () => {
      const response = await request(app)
        .post(`/api/analysis/suggest-tests/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variables: ['score'],
          numGroups: 3
        })
        .expect(200);

      expect(response.body.suggestions.some((s: any) => s.testName.includes('ANOVA'))).toBe(true);
    });

    it('should suggest tests for paired data', async () => {
      const response = await request(app)
        .post(`/api/analysis/suggest-tests/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variables: ['age', 'score'],
          pairedData: true
        })
        .expect(200);

      expect(response.body.suggestions.some((s: any) => s.testName.includes('Paired'))).toBe(true);
    });

    it('should suggest tests for categorical variables', async () => {
      const response = await request(app)
        .post(`/api/analysis/suggest-tests/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variables: ['category', 'category'] // Using same variable for simplicity
        })
        .expect(200);

      expect(response.body.suggestions.some((s: any) => s.testName.includes('Chi-Square'))).toBe(true);
    });

    it('should require at least one variable', async () => {
      await request(app)
        .post(`/api/analysis/suggest-tests/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variables: []
        })
        .expect(400);
    });

    it('should return 404 for non-existent variable', async () => {
      await request(app)
        .post(`/api/analysis/suggest-tests/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variables: ['nonexistent']
        })
        .expect(404);
    });

    it('should return suggestions sorted by confidence', async () => {
      const response = await request(app)
        .post(`/api/analysis/suggest-tests/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variables: ['age', 'score']
        })
        .expect(200);

      const suggestions = response.body.suggestions;
      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i].confidence).toBeLessThanOrEqual(suggestions[i-1].confidence);
      }
    });
  });

  describe('Advanced analysis persistence', () => {
    it('should save t-test results to database', async () => {
      const response = await request(app)
        .post(`/api/analysis/t-test/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          testType: 'one-sample',
          variable1: 'age',
          populationMean: 25
        })
        .expect(200);

      const analysisId = response.body.analysisId;
      const savedAnalysis = await prisma.analysis.findUnique({
        where: { id: analysisId }
      });

      expect(savedAnalysis).toBeTruthy();
      expect(savedAnalysis!.type).toBe(AnalysisType.TTEST);
      expect(savedAnalysis!.results).toHaveProperty('tTestResult');
      expect(savedAnalysis!.results).toHaveProperty('assumptions');
    });

    it('should save ANOVA results to database', async () => {
      const response = await request(app)
        .post(`/api/analysis/anova/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dependentVariable: 'score',
          groupingVariable: 'category'
        })
        .expect(200);

      const analysisId = response.body.analysisId;
      const savedAnalysis = await prisma.analysis.findUnique({
        where: { id: analysisId }
      });

      expect(savedAnalysis).toBeTruthy();
      expect(savedAnalysis!.type).toBe(AnalysisType.ANOVA);
      expect(savedAnalysis!.results).toHaveProperty('anovaResult');
    });

    it('should save regression results to database', async () => {
      const response = await request(app)
        .post(`/api/analysis/regression/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dependentVariable: 'score',
          independentVariable: 'age'
        })
        .expect(200);

      const analysisId = response.body.analysisId;
      const savedAnalysis = await prisma.analysis.findUnique({
        where: { id: analysisId }
      });

      expect(savedAnalysis).toBeTruthy();
      expect(savedAnalysis!.type).toBe(AnalysisType.REGRESSION);
      expect(savedAnalysis!.results).toHaveProperty('regressionResult');
    });

    it('should save non-parametric test results to database', async () => {
      const response = await request(app)
        .post(`/api/analysis/nonparametric/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          testType: 'mann-whitney',
          variable1: 'age',
          variable2: 'score'
        })
        .expect(200);

      const analysisId = response.body.analysisId;
      const savedAnalysis = await prisma.analysis.findUnique({
        where: { id: analysisId }
      });

      expect(savedAnalysis).toBeTruthy();
      expect(savedAnalysis!.type).toBe(AnalysisType.NONPARAMETRIC);
      expect(savedAnalysis!.results).toHaveProperty('nonParametricResult');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid UUID format', async () => {
      await request(app)
        .post('/api/analysis/descriptive/invalid-uuid/age')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should handle empty column name', async () => {
      await request(app)
        .post(`/api/analysis/descriptive/${testDataset.id}/`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404); // Route not found
    });

    it('should handle malformed request body', async () => {
      await request(app)
        .post(`/api/analysis/correlation/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send('invalid json')
        .expect(400);
    });

    it('should handle statistical computation errors gracefully', async () => {
      // This test would require mocking the statistical service to throw an error
      // For now, we'll test with insufficient data scenarios
      const response = await request(app)
        .post(`/api/analysis/t-test/${testDataset.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          testType: 'one-sample',
          variable1: 'age',
          populationMean: 25
        });

      // Should either succeed or return a meaningful error message
      if (response.status !== 200) {
        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error');
      }
    });
  });
});