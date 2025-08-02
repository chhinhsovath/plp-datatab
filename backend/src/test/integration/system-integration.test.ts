import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { initializeDatabase, closeDatabase } from '../../lib/database.js';
import { initializeRedis, closeRedis } from '../../lib/redis.js';
import { JobQueue } from '../../lib/job-queue.js';
import authRoutes from '../../routes/auth.js';
import uploadRoutes from '../../routes/upload.js';
import preprocessingRoutes from '../../routes/preprocessing.js';
import statisticalAnalysisRoutes from '../../routes/statistical-analysis.js';
import reportsRoutes from '../../routes/reports.js';
import collaborationRoutes from '../../routes/collaboration.js';
import { errorHandler } from '../../middleware/error-handler.js';
import fs from 'fs';
import path from 'path';

describe('System Integration Tests', () => {
  let app: express.Application;
  let authToken: string;
  let userId: string;
  let projectId: string;
  let datasetId: string;
  let analysisId: string;
  let reportId: string;

  beforeAll(async () => {
    // Initialize test application
    app = express();
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Initialize services
    await initializeDatabase();
    await initializeRedis();
    await JobQueue.initialize();

    // Setup routes
    app.use('/api/auth', authRoutes);
    app.use('/api/upload', uploadRoutes);
    app.use('/api/preprocessing', preprocessingRoutes);
    app.use('/api/analysis', statisticalAnalysisRoutes);
    app.use('/api/reports', reportsRoutes);
    app.use('/api/collaboration', collaborationRoutes);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await JobQueue.close();
    await closeRedis();
    await closeDatabase();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    // This would typically involve database cleanup
  });

  describe('Complete User Workflow Integration', () => {
    it('should complete full data analysis workflow', async () => {
      // Step 1: User Registration and Authentication
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'testpassword123'
        });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body).toHaveProperty('token');
      authToken = registerResponse.body.token;
      userId = registerResponse.body.user.id;

      // Step 2: Create Project
      const projectResponse = await request(app)
        .post('/api/collaboration/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Integration Test Project',
          description: 'Test project for system integration'
        });

      expect(projectResponse.status).toBe(201);
      expect(projectResponse.body).toHaveProperty('id');
      projectId = projectResponse.body.id;

      // Step 3: Upload Dataset
      const csvData = 'name,age,score\nAlice,25,85\nBob,30,92\nCharlie,35,78\nDiana,28,95\nEve,32,88';
      const uploadResponse = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from(csvData), 'test_data.csv')
        .field('projectId', projectId);

      expect(uploadResponse.status).toBe(200);
      expect(uploadResponse.body).toHaveProperty('datasetId');
      datasetId = uploadResponse.body.datasetId;

      // Verify dataset metadata
      expect(uploadResponse.body.metadata).toHaveProperty('columns');
      expect(uploadResponse.body.metadata.columns).toHaveLength(3);
      expect(uploadResponse.body.metadata.rowCount).toBe(5);

      // Step 4: Data Preprocessing
      const preprocessingResponse = await request(app)
        .post('/api/preprocessing/clean')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          datasetId,
          operations: [
            {
              type: 'handle_missing_values',
              column: 'score',
              strategy: 'mean'
            },
            {
              type: 'remove_outliers',
              column: 'age',
              method: 'iqr'
            }
          ]
        });

      expect(preprocessingResponse.status).toBe(200);
      expect(preprocessingResponse.body).toHaveProperty('processedDatasetId');

      // Step 5: Statistical Analysis - Descriptive Statistics
      const descriptiveResponse = await request(app)
        .post('/api/analysis/descriptive')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          datasetId,
          columns: ['age', 'score']
        });

      expect(descriptiveResponse.status).toBe(200);
      expect(descriptiveResponse.body).toHaveProperty('results');
      expect(descriptiveResponse.body.results).toHaveProperty('age');
      expect(descriptiveResponse.body.results).toHaveProperty('score');
      expect(descriptiveResponse.body.results.age).toHaveProperty('mean');
      expect(descriptiveResponse.body.results.age).toHaveProperty('standardDeviation');

      // Step 6: Statistical Analysis - Hypothesis Testing
      const tTestResponse = await request(app)
        .post('/api/analysis/t-test')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          datasetId,
          testType: 'one-sample',
          variable: 'score',
          testValue: 85,
          alpha: 0.05
        });

      expect(tTestResponse.status).toBe(200);
      expect(tTestResponse.body).toHaveProperty('testStatistic');
      expect(tTestResponse.body).toHaveProperty('pValue');
      expect(tTestResponse.body).toHaveProperty('confidenceInterval');
      analysisId = tTestResponse.body.analysisId;

      // Step 7: Correlation Analysis
      const correlationResponse = await request(app)
        .post('/api/analysis/correlation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          datasetId,
          variables: ['age', 'score'],
          method: 'pearson'
        });

      expect(correlationResponse.status).toBe(200);
      expect(correlationResponse.body).toHaveProperty('correlationMatrix');
      expect(correlationResponse.body).toHaveProperty('pValues');

      // Step 8: Create Report
      const reportResponse = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          title: 'Integration Test Report',
          description: 'Comprehensive analysis report',
          sections: [
            {
              type: 'text',
              content: 'This report presents the results of our statistical analysis.',
              formatting: { fontSize: 12, fontFamily: 'Arial' }
            },
            {
              type: 'analysis',
              analysisId,
              includeInterpretation: true
            }
          ],
          template: 'standard',
          formatting: {
            applyAPAStyle: true,
            includeTableOfContents: true
          }
        });

      expect(reportResponse.status).toBe(201);
      expect(reportResponse.body).toHaveProperty('id');
      reportId = reportResponse.body.id;

      // Step 9: Export Report
      const exportResponse = await request(app)
        .post(`/api/reports/${reportId}/export`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'pdf',
          includeCharts: true,
          includeRawData: false
        });

      expect(exportResponse.status).toBe(200);
      expect(exportResponse.headers['content-type']).toBe('application/pdf');

      // Step 10: Collaboration - Add Collaborator
      const collaboratorResponse = await request(app)
        .post(`/api/collaboration/projects/${projectId}/collaborators`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'collaborator@example.com',
          role: 'EDITOR'
        });

      expect(collaboratorResponse.status).toBe(200);
      expect(collaboratorResponse.body).toHaveProperty('invitationId');

      // Step 11: Real-time Collaboration Test
      const commentResponse = await request(app)
        .post(`/api/collaboration/projects/${projectId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'The analysis results look promising!',
          targetType: 'analysis',
          targetId: analysisId
        });

      expect(commentResponse.status).toBe(201);
      expect(commentResponse.body).toHaveProperty('id');
    });

    it('should handle concurrent user operations', async () => {
      // Create multiple users
      const users = await Promise.all([
        request(app).post('/api/auth/register').send({
          name: 'User 1',
          email: 'user1@example.com',
          password: 'password123'
        }),
        request(app).post('/api/auth/register').send({
          name: 'User 2',
          email: 'user2@example.com',
          password: 'password123'
        }),
        request(app).post('/api/auth/register').send({
          name: 'User 3',
          email: 'user3@example.com',
          password: 'password123'
        })
      ]);

      const tokens = users.map(response => response.body.token);

      // Create project with first user
      const projectResponse = await request(app)
        .post('/api/collaboration/projects')
        .set('Authorization', `Bearer ${tokens[0]}`)
        .send({
          name: 'Concurrent Test Project',
          description: 'Testing concurrent operations'
        });

      const testProjectId = projectResponse.body.id;

      // Upload datasets concurrently
      const csvData1 = 'x,y\n1,2\n3,4\n5,6';
      const csvData2 = 'a,b\n10,20\n30,40\n50,60';
      const csvData3 = 'p,q\n100,200\n300,400\n500,600';

      const uploadPromises = [
        request(app)
          .post('/api/upload')
          .set('Authorization', `Bearer ${tokens[0]}`)
          .attach('file', Buffer.from(csvData1), 'data1.csv')
          .field('projectId', testProjectId),
        request(app)
          .post('/api/upload')
          .set('Authorization', `Bearer ${tokens[1]}`)
          .attach('file', Buffer.from(csvData2), 'data2.csv')
          .field('projectId', testProjectId),
        request(app)
          .post('/api/upload')
          .set('Authorization', `Bearer ${tokens[2]}`)
          .attach('file', Buffer.from(csvData3), 'data3.csv')
          .field('projectId', testProjectId)
      ];

      const uploadResults = await Promise.all(uploadPromises);
      uploadResults.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.body).toHaveProperty('datasetId');
      });

      // Perform concurrent analyses
      const analysisPromises = uploadResults.map((result, index) =>
        request(app)
          .post('/api/analysis/descriptive')
          .set('Authorization', `Bearer ${tokens[index]}`)
          .send({
            datasetId: result.body.datasetId,
            columns: index === 0 ? ['x', 'y'] : index === 1 ? ['a', 'b'] : ['p', 'q']
          })
      );

      const analysisResults = await Promise.all(analysisPromises);
      analysisResults.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.body).toHaveProperty('results');
      });
    });

    it('should validate statistical accuracy', async () => {
      // Register user
      const authResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Stats Test User',
          email: 'stats@example.com',
          password: 'password123'
        });

      const token = authResponse.body.token;

      // Create project
      const projectResponse = await request(app)
        .post('/api/collaboration/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Statistical Validation Project',
          description: 'Testing statistical accuracy'
        });

      const testProjectId = projectResponse.body.id;

      // Upload known dataset with expected results
      const knownData = 'value\n1\n2\n3\n4\n5\n6\n7\n8\n9\n10';
      const uploadResponse = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from(knownData), 'known_data.csv')
        .field('projectId', testProjectId);

      const testDatasetId = uploadResponse.body.datasetId;

      // Test descriptive statistics with known values
      const descriptiveResponse = await request(app)
        .post('/api/analysis/descriptive')
        .set('Authorization', `Bearer ${token}`)
        .send({
          datasetId: testDatasetId,
          columns: ['value']
        });

      expect(descriptiveResponse.status).toBe(200);
      const stats = descriptiveResponse.body.results.value;

      // Validate against known statistical values
      expect(stats.mean).toBeCloseTo(5.5, 2);
      expect(stats.median).toBeCloseTo(5.5, 2);
      expect(stats.standardDeviation).toBeCloseTo(3.0277, 3);
      expect(stats.variance).toBeCloseTo(9.1667, 3);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(10);

      // Test one-sample t-test
      const tTestResponse = await request(app)
        .post('/api/analysis/t-test')
        .set('Authorization', `Bearer ${token}`)
        .send({
          datasetId: testDatasetId,
          testType: 'one-sample',
          variable: 'value',
          testValue: 5.5,
          alpha: 0.05
        });

      expect(tTestResponse.status).toBe(200);
      // For this dataset, testing against the mean should give p-value close to 1
      expect(tTestResponse.body.pValue).toBeGreaterThan(0.9);
    });

    it('should handle error scenarios gracefully', async () => {
      // Register user
      const authResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Error Test User',
          email: 'error@example.com',
          password: 'password123'
        });

      const token = authResponse.body.token;

      // Test invalid file upload
      const invalidUploadResponse = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('invalid data'), 'invalid.txt');

      expect(invalidUploadResponse.status).toBe(400);
      expect(invalidUploadResponse.body).toHaveProperty('error');

      // Test analysis with non-existent dataset
      const invalidAnalysisResponse = await request(app)
        .post('/api/analysis/descriptive')
        .set('Authorization', `Bearer ${token}`)
        .send({
          datasetId: 'non-existent-id',
          columns: ['column1']
        });

      expect(invalidAnalysisResponse.status).toBe(404);
      expect(invalidAnalysisResponse.body).toHaveProperty('error');

      // Test unauthorized access
      const unauthorizedResponse = await request(app)
        .post('/api/analysis/descriptive')
        .send({
          datasetId: 'some-id',
          columns: ['column1']
        });

      expect(unauthorizedResponse.status).toBe(401);
      expect(unauthorizedResponse.body).toHaveProperty('error');
    });

    it('should maintain data consistency across operations', async () => {
      // Register user
      const authResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Consistency Test User',
          email: 'consistency@example.com',
          password: 'password123'
        });

      const token = authResponse.body.token;

      // Create project
      const projectResponse = await request(app)
        .post('/api/collaboration/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Consistency Test Project',
          description: 'Testing data consistency'
        });

      const testProjectId = projectResponse.body.id;

      // Upload dataset
      const csvData = 'id,value\n1,10\n2,20\n3,30\n4,40\n5,50';
      const uploadResponse = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from(csvData), 'consistency_data.csv')
        .field('projectId', testProjectId);

      const testDatasetId = uploadResponse.body.datasetId;

      // Perform multiple operations and verify consistency
      const operations = [
        request(app)
          .post('/api/analysis/descriptive')
          .set('Authorization', `Bearer ${token}`)
          .send({ datasetId: testDatasetId, columns: ['value'] }),
        request(app)
          .post('/api/analysis/correlation')
          .set('Authorization', `Bearer ${token}`)
          .send({ datasetId: testDatasetId, variables: ['id', 'value'] }),
        request(app)
          .get(`/api/upload/dataset/${testDatasetId}/metadata`)
          .set('Authorization', `Bearer ${token}`)
      ];

      const results = await Promise.all(operations);
      
      // All operations should succeed
      results.forEach(result => {
        expect(result.status).toBeLessThan(400);
      });

      // Verify data consistency
      const metadata = results[2].body;
      expect(metadata.rowCount).toBe(5);
      expect(metadata.columns).toHaveLength(2);

      const descriptiveStats = results[0].body.results.value;
      expect(descriptiveStats.count).toBe(5);
      expect(descriptiveStats.mean).toBe(30);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle large dataset processing', async () => {
      // Register user
      const authResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Performance Test User',
          email: 'performance@example.com',
          password: 'password123'
        });

      const token = authResponse.body.token;

      // Create project
      const projectResponse = await request(app)
        .post('/api/collaboration/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Performance Test Project',
          description: 'Testing performance with large datasets'
        });

      const testProjectId = projectResponse.body.id;

      // Generate large dataset (1000 rows)
      let largeData = 'id,value1,value2,category\n';
      for (let i = 1; i <= 1000; i++) {
        largeData += `${i},${Math.random() * 100},${Math.random() * 50},${i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C'}\n`;
      }

      const startUpload = Date.now();
      const uploadResponse = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from(largeData), 'large_data.csv')
        .field('projectId', testProjectId);

      const uploadTime = Date.now() - startUpload;
      expect(uploadResponse.status).toBe(200);
      expect(uploadTime).toBeLessThan(10000); // Should complete within 10 seconds

      const largeDatasetId = uploadResponse.body.datasetId;

      // Test analysis performance
      const startAnalysis = Date.now();
      const analysisResponse = await request(app)
        .post('/api/analysis/descriptive')
        .set('Authorization', `Bearer ${token}`)
        .send({
          datasetId: largeDatasetId,
          columns: ['value1', 'value2']
        });

      const analysisTime = Date.now() - startAnalysis;
      expect(analysisResponse.status).toBe(200);
      expect(analysisTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify results are accurate
      const stats = analysisResponse.body.results;
      expect(stats.value1.count).toBe(1000);
      expect(stats.value2.count).toBe(1000);
    });

    it('should handle concurrent analysis requests', async () => {
      // Register user
      const authResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Concurrent Test User',
          email: 'concurrent@example.com',
          password: 'password123'
        });

      const token = authResponse.body.token;

      // Create project and upload dataset
      const projectResponse = await request(app)
        .post('/api/collaboration/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Concurrent Analysis Project',
          description: 'Testing concurrent analysis requests'
        });

      const testProjectId = projectResponse.body.id;

      const csvData = 'x,y,z\n' + Array.from({ length: 100 }, (_, i) => `${i},${i*2},${i*3}`).join('\n');
      const uploadResponse = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from(csvData), 'concurrent_data.csv')
        .field('projectId', testProjectId);

      const concurrentDatasetId = uploadResponse.body.datasetId;

      // Perform multiple concurrent analyses
      const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/analysis/descriptive')
          .set('Authorization', `Bearer ${token}`)
          .send({
            datasetId: concurrentDatasetId,
            columns: ['x', 'y', 'z']
          })
      );

      const startTime = Date.now();
      const results = await Promise.all(concurrentRequests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.body.results.x.count).toBe(100);
      });

      // Should handle concurrent requests efficiently
      expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });
});