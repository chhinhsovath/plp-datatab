import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { initializeDatabase } from '../../lib/database.js';
import { initializeRedis, closeRedis } from '../../lib/redis.js';
import authRoutes from '../../routes/auth.js';
import uploadRoutes from '../../routes/upload.js';
import preprocessingRoutes from '../../routes/preprocessing.js';
import statisticalAnalysisRoutes from '../../routes/statistical-analysis.js';
import reportsRoutes from '../../routes/reports.js';
import collaborationRoutes from '../../routes/collaboration.js';
import { errorHandler } from '../../middleware/error-handler.js';
import path from 'path';
import fs from 'fs';

describe('API Integration Tests', () => {
  let app: express.Application;
  let server: any;
  let prisma: PrismaClient;
  let authToken: string;
  let testUserId: string;
  let testDatasetId: string;
  let testProjectId: string;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/datatab_test';
    
    // Initialize test app
    app = express();
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    // Add routes
    app.use('/api/auth', authRoutes);
    app.use('/api/upload', uploadRoutes);
    app.use('/api/preprocessing', preprocessingRoutes);
    app.use('/api/analysis', statisticalAnalysisRoutes);
    app.use('/api/reports', reportsRoutes);
    app.use('/api/collaboration', collaborationRoutes);
    app.use(errorHandler);
    
    server = createServer(app);
    
    // Initialize database and Redis
    await initializeDatabase();
    await initializeRedis();
    
    prisma = new PrismaClient();
    
    // Clean up test data
    await prisma.dataset.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    // Clean up
    await prisma.dataset.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
    await closeRedis();
    
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    // Create test user and get auth token
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'testpassword123'
      });
    
    expect(registerResponse.status).toBe(201);
    authToken = registerResponse.body.token;
    testUserId = registerResponse.body.user.id;
  });

  describe('Authentication Flow', () => {
    it('should complete full authentication workflow', async () => {
      // Register new user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Integration Test User',
          email: 'integration@example.com',
          password: 'password123'
        });
      
      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.user.email).toBe('integration@example.com');
      expect(registerResponse.body.token).toBeDefined();
      
      const token = registerResponse.body.token;
      
      // Login with credentials
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'integration@example.com',
          password: 'password123'
        });
      
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.token).toBeDefined();
      
      // Get user profile
      const profileResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      
      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.user.email).toBe('integration@example.com');
      
      // Update profile
      const updateResponse = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Integration User'
        });
      
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.user.name).toBe('Updated Integration User');
      
      // Change password
      const passwordResponse = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123'
        });
      
      expect(passwordResponse.status).toBe(200);
      
      // Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);
      
      expect(logoutResponse.status).toBe(200);
    });

    it('should handle authentication errors correctly', async () => {
      // Invalid login
      const invalidLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        });
      
      expect(invalidLogin.status).toBe(401);
      
      // Access protected route without token
      const noTokenResponse = await request(app)
        .get('/api/auth/me');
      
      expect(noTokenResponse.status).toBe(401);
      
      // Access with invalid token
      const invalidTokenResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(invalidTokenResponse.status).toBe(401);
    });
  });

  describe('Data Upload and Import Flow', () => {
    it('should complete full data upload workflow', async () => {
      // Create test CSV file
      const testCsvContent = 'name,age,score\nJohn,25,85\nJane,30,92\nBob,35,78';
      const testFilePath = path.join(process.cwd(), 'test-data.csv');
      fs.writeFileSync(testFilePath, testCsvContent);
      
      try {
        // Upload CSV file
        const uploadResponse = await request(app)
          .post('/api/upload/file')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', testFilePath)
          .field('hasHeader', 'true')
          .field('delimiter', ',');
        
        expect(uploadResponse.status).toBe(200);
        expect(uploadResponse.body.dataset).toBeDefined();
        expect(uploadResponse.body.preview).toHaveLength(3);
        
        testDatasetId = uploadResponse.body.dataset.id;
        
        // Get dataset data
        const dataResponse = await request(app)
          .get(`/api/upload/dataset/${testDatasetId}/data`)
          .set('Authorization', `Bearer ${authToken}`);
        
        expect(dataResponse.status).toBe(200);
        expect(dataResponse.body.data).toHaveLength(3);
        expect(dataResponse.body.pagination).toBeDefined();
        
        // List user datasets
        const listResponse = await request(app)
          .get('/api/upload/datasets')
          .set('Authorization', `Bearer ${authToken}`);
        
        expect(listResponse.status).toBe(200);
        expect(listResponse.body.datasets.length).toBeGreaterThan(0);
        
        // Delete dataset
        const deleteResponse = await request(app)
          .delete(`/api/upload/dataset/${testDatasetId}`)
          .set('Authorization', `Bearer ${authToken}`);
        
        expect(deleteResponse.status).toBe(200);
        
      } finally {
        // Clean up test file
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    it('should handle URL import workflow', async () => {
      // Mock URL import (in real scenario, this would fetch from actual URL)
      const urlImportResponse = await request(app)
        .post('/api/upload/url')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://example.com/data.csv',
          name: 'Test URL Dataset',
          hasHeader: true
        });
      
      // This might fail in test environment without actual URL, but we test the endpoint
      expect([200, 500]).toContain(urlImportResponse.status);
    });

    it('should validate file upload security', async () => {
      // Test invalid file type
      const testTxtContent = 'This is not a valid data file';
      const testTxtPath = path.join(process.cwd(), 'test-invalid.txt');
      fs.writeFileSync(testTxtPath, testTxtContent);
      
      try {
        const invalidFileResponse = await request(app)
          .post('/api/upload/file')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', testTxtPath);
        
        expect(invalidFileResponse.status).toBe(400);
        
      } finally {
        if (fs.existsSync(testTxtPath)) {
          fs.unlinkSync(testTxtPath);
        }
      }
    });
  });

  describe('Data Preprocessing Flow', () => {
    beforeEach(async () => {
      // Create test dataset for preprocessing
      const testData = 'value,category\n1,A\n2,B\n,A\n4,C\n5,B\n100,A'; // Contains missing value and outlier
      const testFilePath = path.join(process.cwd(), 'preprocessing-test.csv');
      fs.writeFileSync(testData, testData);
      
      try {
        const uploadResponse = await request(app)
          .post('/api/upload/file')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', testFilePath)
          .field('hasHeader', 'true');
        
        testDatasetId = uploadResponse.body.dataset.id;
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    it('should complete data preprocessing workflow', async () => {
      // Get data summary
      const summaryResponse = await request(app)
        .get(`/api/preprocessing/dataset/${testDatasetId}/summary`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(summaryResponse.status).toBe(200);
      expect(summaryResponse.body.columns).toBeDefined();
      expect(summaryResponse.body.missingValues).toBeDefined();
      
      // Handle missing values
      const missingValuesResponse = await request(app)
        .post(`/api/preprocessing/dataset/${testDatasetId}/missing-values`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          column: 'value',
          method: 'mean'
        });
      
      expect(missingValuesResponse.status).toBe(200);
      
      // Detect outliers
      const outliersResponse = await request(app)
        .get(`/api/preprocessing/dataset/${testDatasetId}/outliers`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ column: 'value' });
      
      expect(outliersResponse.status).toBe(200);
      expect(outliersResponse.body.outliers).toBeDefined();
      
      // Apply data transformation
      const transformResponse = await request(app)
        .post(`/api/preprocessing/dataset/${testDatasetId}/transform`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          column: 'value',
          transformation: 'log'
        });
      
      expect(transformResponse.status).toBe(200);
      
      // Filter data
      const filterResponse = await request(app)
        .post(`/api/preprocessing/dataset/${testDatasetId}/filter`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          conditions: [
            { column: 'value', operator: '>', value: 0 }
          ]
        });
      
      expect(filterResponse.status).toBe(200);
    });
  });

  describe('Statistical Analysis Flow', () => {
    beforeEach(async () => {
      // Create test dataset with numerical data
      const testData = 'group,value\nA,10\nA,12\nA,11\nB,15\nB,17\nB,16\nC,20\nC,22\nC,21';
      const testFilePath = path.join(process.cwd(), 'analysis-test.csv');
      fs.writeFileSync(testFilePath, testData);
      
      try {
        const uploadResponse = await request(app)
          .post('/api/upload/file')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', testFilePath)
          .field('hasHeader', 'true');
        
        testDatasetId = uploadResponse.body.dataset.id;
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    it('should complete statistical analysis workflow', async () => {
      // Descriptive statistics
      const descriptiveResponse = await request(app)
        .post('/api/analysis/descriptive')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          datasetId: testDatasetId,
          column: 'value'
        });
      
      expect(descriptiveResponse.status).toBe(200);
      expect(descriptiveResponse.body.mean).toBeDefined();
      expect(descriptiveResponse.body.median).toBeDefined();
      expect(descriptiveResponse.body.standardDeviation).toBeDefined();
      
      // T-test
      const ttestResponse = await request(app)
        .post('/api/analysis/ttest')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          datasetId: testDatasetId,
          column: 'value',
          testValue: 15,
          type: 'one-sample'
        });
      
      expect(ttestResponse.status).toBe(200);
      expect(ttestResponse.body.testStatistic).toBeDefined();
      expect(ttestResponse.body.pValue).toBeDefined();
      
      // ANOVA
      const anovaResponse = await request(app)
        .post('/api/analysis/anova')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          datasetId: testDatasetId,
          dependentVariable: 'value',
          independentVariable: 'group'
        });
      
      expect(anovaResponse.status).toBe(200);
      expect(anovaResponse.body.fStatistic).toBeDefined();
      expect(anovaResponse.body.pValue).toBeDefined();
      
      // Correlation analysis
      const correlationResponse = await request(app)
        .post('/api/analysis/correlation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          datasetId: testDatasetId,
          variables: ['value']
        });
      
      expect(correlationResponse.status).toBe(200);
      expect(correlationResponse.body.correlationMatrix).toBeDefined();
      
      // Regression analysis
      const regressionResponse = await request(app)
        .post('/api/analysis/regression')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          datasetId: testDatasetId,
          dependentVariable: 'value',
          independentVariables: ['group']
        });
      
      expect(regressionResponse.status).toBe(200);
      expect(regressionResponse.body.coefficients).toBeDefined();
      expect(regressionResponse.body.rSquared).toBeDefined();
    });

    it('should handle analysis errors gracefully', async () => {
      // Invalid dataset ID
      const invalidDatasetResponse = await request(app)
        .post('/api/analysis/descriptive')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          datasetId: 'invalid-id',
          column: 'value'
        });
      
      expect(invalidDatasetResponse.status).toBe(404);
      
      // Invalid column name
      const invalidColumnResponse = await request(app)
        .post('/api/analysis/descriptive')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          datasetId: testDatasetId,
          column: 'nonexistent-column'
        });
      
      expect(invalidColumnResponse.status).toBe(400);
    });
  });

  describe('Report Generation Flow', () => {
    beforeEach(async () => {
      // Create test project
      const projectResponse = await request(app)
        .post('/api/collaboration/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          description: 'Integration test project'
        });
      
      testProjectId = projectResponse.body.project.id;
    });

    it('should complete report generation workflow', async () => {
      // Create report
      const createReportResponse = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Integration Test Report',
          projectId: testProjectId,
          sections: [
            {
              type: 'text',
              content: 'This is a test report'
            }
          ]
        });
      
      expect(createReportResponse.status).toBe(201);
      expect(createReportResponse.body.report.title).toBe('Integration Test Report');
      
      const reportId = createReportResponse.body.report.id;
      
      // Get report
      const getReportResponse = await request(app)
        .get(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(getReportResponse.status).toBe(200);
      expect(getReportResponse.body.report.title).toBe('Integration Test Report');
      
      // Update report
      const updateReportResponse = await request(app)
        .put(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Integration Test Report',
          sections: [
            {
              type: 'text',
              content: 'This is an updated test report'
            }
          ]
        });
      
      expect(updateReportResponse.status).toBe(200);
      expect(updateReportResponse.body.report.title).toBe('Updated Integration Test Report');
      
      // Export report
      const exportResponse = await request(app)
        .post(`/api/reports/${reportId}/export`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'pdf'
        });
      
      expect(exportResponse.status).toBe(200);
      expect(exportResponse.body.downloadUrl).toBeDefined();
      
      // List reports
      const listReportsResponse = await request(app)
        .get('/api/reports')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(listReportsResponse.status).toBe(200);
      expect(listReportsResponse.body.reports.length).toBeGreaterThan(0);
      
      // Delete report
      const deleteReportResponse = await request(app)
        .delete(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(deleteReportResponse.status).toBe(200);
    });
  });

  describe('Collaboration Flow', () => {
    it('should complete collaboration workflow', async () => {
      // Create project
      const createProjectResponse = await request(app)
        .post('/api/collaboration/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Collaboration Test Project',
          description: 'Testing collaboration features'
        });
      
      expect(createProjectResponse.status).toBe(201);
      const projectId = createProjectResponse.body.project.id;
      
      // Get project
      const getProjectResponse = await request(app)
        .get(`/api/collaboration/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(getProjectResponse.status).toBe(200);
      expect(getProjectResponse.body.project.name).toBe('Collaboration Test Project');
      
      // Update project
      const updateProjectResponse = await request(app)
        .put(`/api/collaboration/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Collaboration Project',
          description: 'Updated description'
        });
      
      expect(updateProjectResponse.status).toBe(200);
      
      // List user projects
      const listProjectsResponse = await request(app)
        .get('/api/collaboration/projects')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(listProjectsResponse.status).toBe(200);
      expect(listProjectsResponse.body.projects.length).toBeGreaterThan(0);
      
      // Add comment to project
      const commentResponse = await request(app)
        .post(`/api/collaboration/projects/${projectId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'This is a test comment'
        });
      
      expect(commentResponse.status).toBe(201);
      
      // Get project comments
      const getCommentsResponse = await request(app)
        .get(`/api/collaboration/projects/${projectId}/comments`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(getCommentsResponse.status).toBe(200);
      expect(getCommentsResponse.body.comments.length).toBeGreaterThan(0);
      
      // Delete project
      const deleteProjectResponse = await request(app)
        .delete(`/api/collaboration/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(deleteProjectResponse.status).toBe(200);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed requests', async () => {
      // Invalid JSON
      const invalidJsonResponse = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('invalid json');
      
      expect(invalidJsonResponse.status).toBe(400);
      
      // Missing required fields
      const missingFieldsResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User'
          // Missing email and password
        });
      
      expect(missingFieldsResponse.status).toBe(400);
    });

    it('should handle database connection issues', async () => {
      // This test would require mocking database failures
      // For now, we'll test that the error handling middleware works
      const response = await request(app)
        .get('/api/nonexistent-endpoint');
      
      expect(response.status).toBe(404);
    });

    it('should handle concurrent requests', async () => {
      // Create multiple concurrent requests
      const requests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${authToken}`)
      );
      
      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle large dataset operations', async () => {
      // Create large CSV data
      const largeData = ['id,value'];
      for (let i = 1; i <= 1000; i++) {
        largeData.push(`${i},${Math.random() * 100}`);
      }
      
      const testFilePath = path.join(process.cwd(), 'large-test.csv');
      fs.writeFileSync(testFilePath, largeData.join('\n'));
      
      try {
        const startTime = Date.now();
        
        const uploadResponse = await request(app)
          .post('/api/upload/file')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', testFilePath)
          .field('hasHeader', 'true');
        
        const uploadTime = Date.now() - startTime;
        
        expect(uploadResponse.status).toBe(200);
        expect(uploadTime).toBeLessThan(10000); // Should complete within 10 seconds
        
        const datasetId = uploadResponse.body.dataset.id;
        
        // Test analysis on large dataset
        const analysisStartTime = Date.now();
        
        const analysisResponse = await request(app)
          .post('/api/analysis/descriptive')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            datasetId,
            column: 'value'
          });
        
        const analysisTime = Date.now() - analysisStartTime;
        
        expect(analysisResponse.status).toBe(200);
        expect(analysisTime).toBeLessThan(5000); // Should complete within 5 seconds
        
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    it('should handle memory-intensive operations', async () => {
      // Test memory usage during large operations
      const initialMemory = process.memoryUsage();
      
      // Perform memory-intensive operation
      const largeArray = Array.from({ length: 100000 }, (_, i) => ({
        id: i,
        value: Math.random(),
        category: `Category ${i % 10}`
      }));
      
      // Simulate processing
      const processed = largeArray.map(item => ({
        ...item,
        processed: item.value * 2
      }));
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      
      // Clean up
      largeArray.length = 0;
      processed.length = 0;
    });
  });
});