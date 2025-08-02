import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { initializeDatabase, closeDatabase } from '../lib/database.js';
import { initializeRedis, closeRedis } from '../lib/redis.js';
import { JobQueue } from '../lib/job-queue.js';
import authRoutes from '../routes/auth.js';
import uploadRoutes from '../routes/upload.js';
import statisticalAnalysisRoutes from '../routes/statistical-analysis.js';
import { errorHandler } from '../middleware/error-handler.js';

describe('Load Testing and Performance', () => {
  let app: express.Application;
  const testUsers: Array<{ token: string; userId: string }> = [];
  const testDatasets: string[] = [];

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
    app.use('/api/analysis', statisticalAnalysisRoutes);
    app.use(errorHandler);

    // Create test users
    for (let i = 0; i < 10; i++) {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: `Load Test User ${i}`,
          email: `loadtest${i}@example.com`,
          password: 'testpassword123'
        });

      testUsers.push({
        token: response.body.token,
        userId: response.body.user.id
      });
    }

    // Create test datasets
    for (let i = 0; i < 5; i++) {
      const csvData = generateTestData(1000); // 1000 rows each
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${testUsers[0].token}`)
        .attach('file', Buffer.from(csvData), `load_test_data_${i}.csv`);

      testDatasets.push(response.body.datasetId);
    }
  });

  afterAll(async () => {
    await JobQueue.close();
    await closeRedis();
    await closeDatabase();
  });

  function generateTestData(rows: number): string {
    let csv = 'id,value1,value2,value3,category\n';
    for (let i = 1; i <= rows; i++) {
      csv += `${i},${Math.random() * 100},${Math.random() * 50},${Math.random() * 200},${['A', 'B', 'C'][i % 3]}\n`;
    }
    return csv;
  }

  describe('Concurrent User Load Testing', () => {
    it('should handle 10 concurrent users performing analysis', async () => {
      const concurrentRequests = testUsers.map((user, index) =>
        request(app)
          .post('/api/analysis/descriptive')
          .set('Authorization', `Bearer ${user.token}`)
          .send({
            datasetId: testDatasets[index % testDatasets.length],
            columns: ['value1', 'value2', 'value3']
          })
      );

      const startTime = Date.now();
      const results = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      // All requests should succeed
      results.forEach((result, index) => {
        expect(result.status).toBe(200);
        expect(result.body.results).toHaveProperty('value1');
        expect(result.body.results).toHaveProperty('value2');
        expect(result.body.results).toHaveProperty('value3');
      });

      // Should complete within reasonable time (30 seconds for 10 concurrent users)
      expect(endTime - startTime).toBeLessThan(30000);
      
      console.log(`10 concurrent analyses completed in ${endTime - startTime}ms`);
    });

    it('should handle 50 concurrent file uploads', async () => {
      const uploadPromises = Array.from({ length: 50 }, (_, i) => {
        const userIndex = i % testUsers.length;
        const csvData = generateTestData(100); // Smaller datasets for upload test
        
        return request(app)
          .post('/api/upload')
          .set('Authorization', `Bearer ${testUsers[userIndex].token}`)
          .attach('file', Buffer.from(csvData), `concurrent_upload_${i}.csv`);
      });

      const startTime = Date.now();
      const results = await Promise.all(uploadPromises);
      const endTime = Date.now();

      // All uploads should succeed
      results.forEach((result, index) => {
        expect(result.status).toBe(200);
        expect(result.body).toHaveProperty('datasetId');
      });

      // Should complete within reasonable time (60 seconds for 50 uploads)
      expect(endTime - startTime).toBeLessThan(60000);
      
      console.log(`50 concurrent uploads completed in ${endTime - startTime}ms`);
    });

    it('should handle mixed workload (uploads + analyses)', async () => {
      const mixedRequests = [];

      // 20 upload requests
      for (let i = 0; i < 20; i++) {
        const userIndex = i % testUsers.length;
        const csvData = generateTestData(200);
        
        mixedRequests.push(
          request(app)
            .post('/api/upload')
            .set('Authorization', `Bearer ${testUsers[userIndex].token}`)
            .attach('file', Buffer.from(csvData), `mixed_upload_${i}.csv`)
        );
      }

      // 30 analysis requests
      for (let i = 0; i < 30; i++) {
        const userIndex = i % testUsers.length;
        const datasetIndex = i % testDatasets.length;
        
        mixedRequests.push(
          request(app)
            .post('/api/analysis/descriptive')
            .set('Authorization', `Bearer ${testUsers[userIndex].token}`)
            .send({
              datasetId: testDatasets[datasetIndex],
              columns: ['value1', 'value2']
            })
        );
      }

      // Shuffle requests to simulate realistic mixed workload
      for (let i = mixedRequests.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mixedRequests[i], mixedRequests[j]] = [mixedRequests[j], mixedRequests[i]];
      }

      const startTime = Date.now();
      const results = await Promise.all(mixedRequests);
      const endTime = Date.now();

      // All requests should succeed
      results.forEach((result) => {
        expect(result.status).toBe(200);
      });

      // Should complete within reasonable time (90 seconds for mixed workload)
      expect(endTime - startTime).toBeLessThan(90000);
      
      console.log(`Mixed workload (20 uploads + 30 analyses) completed in ${endTime - startTime}ms`);
    });
  });

  describe('Large Dataset Performance', () => {
    it('should handle analysis of 10,000 row dataset', async () => {
      const largeData = generateTestData(10000);
      
      // Upload large dataset
      const uploadResponse = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${testUsers[0].token}`)
        .attach('file', Buffer.from(largeData), 'large_dataset_10k.csv');

      expect(uploadResponse.status).toBe(200);
      const largeDatasetId = uploadResponse.body.datasetId;

      // Perform analysis on large dataset
      const startTime = Date.now();
      const analysisResponse = await request(app)
        .post('/api/analysis/descriptive')
        .set('Authorization', `Bearer ${testUsers[0].token}`)
        .send({
          datasetId: largeDatasetId,
          columns: ['value1', 'value2', 'value3']
        });
      const endTime = Date.now();

      expect(analysisResponse.status).toBe(200);
      expect(analysisResponse.body.results.value1.count).toBe(10000);
      
      // Should complete within 10 seconds
      expect(endTime - startTime).toBeLessThan(10000);
      
      console.log(`Analysis of 10,000 rows completed in ${endTime - startTime}ms`);
    });

    it('should handle analysis of 50,000 row dataset', async () => {
      const veryLargeData = generateTestData(50000);
      
      // Upload very large dataset
      const uploadResponse = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${testUsers[0].token}`)
        .attach('file', Buffer.from(veryLargeData), 'very_large_dataset_50k.csv');

      expect(uploadResponse.status).toBe(200);
      const veryLargeDatasetId = uploadResponse.body.datasetId;

      // Perform analysis on very large dataset
      const startTime = Date.now();
      const analysisResponse = await request(app)
        .post('/api/analysis/descriptive')
        .set('Authorization', `Bearer ${testUsers[0].token}`)
        .send({
          datasetId: veryLargeDatasetId,
          columns: ['value1', 'value2']
        });
      const endTime = Date.now();

      expect(analysisResponse.status).toBe(200);
      expect(analysisResponse.body.results.value1.count).toBe(50000);
      
      // Should complete within 30 seconds
      expect(endTime - startTime).toBeLessThan(30000);
      
      console.log(`Analysis of 50,000 rows completed in ${endTime - startTime}ms`);
    });

    it('should handle correlation analysis on large dataset', async () => {
      const correlationData = generateTestData(5000);
      
      const uploadResponse = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${testUsers[0].token}`)
        .attach('file', Buffer.from(correlationData), 'correlation_dataset_5k.csv');

      const datasetId = uploadResponse.body.datasetId;

      const startTime = Date.now();
      const correlationResponse = await request(app)
        .post('/api/analysis/correlation')
        .set('Authorization', `Bearer ${testUsers[0].token}`)
        .send({
          datasetId,
          variables: ['value1', 'value2', 'value3'],
          method: 'pearson'
        });
      const endTime = Date.now();

      expect(correlationResponse.status).toBe(200);
      expect(correlationResponse.body).toHaveProperty('correlationMatrix');
      
      // Should complete within 5 seconds
      expect(endTime - startTime).toBeLessThan(5000);
      
      console.log(`Correlation analysis of 5,000 rows completed in ${endTime - startTime}ms`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not cause memory leaks with repeated operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform 100 small analyses
      for (let i = 0; i < 100; i++) {
        const response = await request(app)
          .post('/api/analysis/descriptive')
          .set('Authorization', `Bearer ${testUsers[i % testUsers.length].token}`)
          .send({
            datasetId: testDatasets[i % testDatasets.length],
            columns: ['value1']
          });
        
        expect(response.status).toBe(200);
      }

      const finalMemory = process.memoryUsage();
      
      // Memory usage should not increase dramatically
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;
      
      console.log(`Memory increase after 100 operations: ${memoryIncreasePercent.toFixed(2)}%`);
      
      // Memory increase should be less than 50%
      expect(memoryIncreasePercent).toBeLessThan(50);
    });

    it('should handle rapid sequential requests from single user', async () => {
      const rapidRequests = Array.from({ length: 20 }, (_, i) =>
        request(app)
          .post('/api/analysis/descriptive')
          .set('Authorization', `Bearer ${testUsers[0].token}`)
          .send({
            datasetId: testDatasets[i % testDatasets.length],
            columns: ['value1', 'value2']
          })
      );

      const startTime = Date.now();
      const results = await Promise.all(rapidRequests);
      const endTime = Date.now();

      // All requests should succeed
      results.forEach((result) => {
        expect(result.status).toBe(200);
      });

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(15000);
      
      console.log(`20 rapid sequential requests completed in ${endTime - startTime}ms`);
    });
  });

  describe('Error Handling Under Load', () => {
    it('should handle invalid requests gracefully under load', async () => {
      const invalidRequests = Array.from({ length: 50 }, (_, i) =>
        request(app)
          .post('/api/analysis/descriptive')
          .set('Authorization', `Bearer ${testUsers[i % testUsers.length].token}`)
          .send({
            datasetId: 'invalid-dataset-id',
            columns: ['nonexistent_column']
          })
      );

      const results = await Promise.all(invalidRequests);

      // All requests should return appropriate error status
      results.forEach((result) => {
        expect(result.status).toBe(404); // Dataset not found
        expect(result.body).toHaveProperty('error');
      });
    });

    it('should handle mixed valid and invalid requests', async () => {
      const mixedRequests = [];

      // 25 valid requests
      for (let i = 0; i < 25; i++) {
        mixedRequests.push(
          request(app)
            .post('/api/analysis/descriptive')
            .set('Authorization', `Bearer ${testUsers[i % testUsers.length].token}`)
            .send({
              datasetId: testDatasets[i % testDatasets.length],
              columns: ['value1']
            })
        );
      }

      // 25 invalid requests
      for (let i = 0; i < 25; i++) {
        mixedRequests.push(
          request(app)
            .post('/api/analysis/descriptive')
            .set('Authorization', `Bearer ${testUsers[i % testUsers.length].token}`)
            .send({
              datasetId: 'invalid-id',
              columns: ['invalid_column']
            })
        );
      }

      const results = await Promise.all(mixedRequests);

      // Count successful and failed requests
      const successful = results.filter(r => r.status === 200).length;
      const failed = results.filter(r => r.status !== 200).length;

      expect(successful).toBe(25);
      expect(failed).toBe(25);
    });
  });

  describe('Database Connection Pool Testing', () => {
    it('should handle database connection pool exhaustion gracefully', async () => {
      // Create many concurrent requests that require database access
      const dbRequests = Array.from({ length: 100 }, (_, i) =>
        request(app)
          .post('/api/analysis/descriptive')
          .set('Authorization', `Bearer ${testUsers[i % testUsers.length].token}`)
          .send({
            datasetId: testDatasets[i % testDatasets.length],
            columns: ['value1']
          })
      );

      const startTime = Date.now();
      const results = await Promise.all(dbRequests);
      const endTime = Date.now();

      // Most requests should succeed (some might timeout)
      const successful = results.filter(r => r.status === 200).length;
      const total = results.length;
      const successRate = (successful / total) * 100;

      console.log(`Database pool test: ${successful}/${total} requests succeeded (${successRate.toFixed(1)}%)`);
      console.log(`Completed in ${endTime - startTime}ms`);

      // At least 80% should succeed
      expect(successRate).toBeGreaterThan(80);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance benchmarks for common operations', async () => {
      const benchmarks = {
        smallDatasetAnalysis: { maxTime: 1000, dataSize: 100 },
        mediumDatasetAnalysis: { maxTime: 5000, dataSize: 1000 },
        largeDatasetAnalysis: { maxTime: 15000, dataSize: 5000 }
      };

      for (const [testName, benchmark] of Object.entries(benchmarks)) {
        const testData = generateTestData(benchmark.dataSize);
        
        const uploadResponse = await request(app)
          .post('/api/upload')
          .set('Authorization', `Bearer ${testUsers[0].token}`)
          .attach('file', Buffer.from(testData), `${testName}.csv`);

        const datasetId = uploadResponse.body.datasetId;

        const startTime = Date.now();
        const analysisResponse = await request(app)
          .post('/api/analysis/descriptive')
          .set('Authorization', `Bearer ${testUsers[0].token}`)
          .send({
            datasetId,
            columns: ['value1', 'value2', 'value3']
          });
        const endTime = Date.now();

        const duration = endTime - startTime;

        expect(analysisResponse.status).toBe(200);
        expect(duration).toBeLessThan(benchmark.maxTime);

        console.log(`${testName}: ${duration}ms (limit: ${benchmark.maxTime}ms, size: ${benchmark.dataSize} rows)`);
      }
    });
  });
});