import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { StatisticalAnalysisService } from '../lib/statistical-analysis.js';
import { DataImportService } from '../lib/data-import.js';
import { DataPreprocessingService } from '../lib/data-preprocessing.js';
import fs from 'fs';
import path from 'path';

describe('Performance Tests', () => {
  const testDataDir = path.join(process.cwd(), 'test-data');
  
  beforeAll(() => {
    // Create test data directory
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test data
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('Large Dataset Handling', () => {
    it('should handle 10K rows efficiently', async () => {
      const rowCount = 10000;
      const data = generateTestData(rowCount);
      
      const startTime = performance.now();
      const stats = StatisticalAnalysisService.calculateDescriptiveStats(data.values);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(stats.count).toBe(rowCount);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
      expect(stats.mean).toBeDefined();
      expect(stats.standardDeviation).toBeDefined();
    });

    it('should handle 100K rows efficiently', async () => {
      const rowCount = 100000;
      const data = generateTestData(rowCount);
      
      const startTime = performance.now();
      const stats = StatisticalAnalysisService.calculateDescriptiveStats(data.values);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(stats.count).toBe(rowCount);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle 1M rows with reasonable performance', async () => {
      const rowCount = 1000000;
      const data = generateTestData(rowCount);
      
      const startTime = performance.now();
      const stats = StatisticalAnalysisService.calculateDescriptiveStats(data.values);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(stats.count).toBe(rowCount);
      expect(executionTime).toBeLessThan(30000); // Should complete within 30 seconds
    });

    it('should handle memory efficiently with large datasets', () => {
      const initialMemory = process.memoryUsage();
      const rowCount = 100000;
      
      // Generate and process large dataset
      const data = generateTestData(rowCount);
      const stats = StatisticalAnalysisService.calculateDescriptiveStats(data.values);
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 500MB for 100K rows)
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024);
      expect(stats.count).toBe(rowCount);
    });
  });

  describe('Statistical Analysis Performance', () => {
    const testSizes = [1000, 10000, 50000];
    
    testSizes.forEach(size => {
      it(`should perform t-test efficiently with ${size} samples`, () => {
        const group1 = Array.from({ length: size }, () => Math.random() * 10 + 50);
        const group2 = Array.from({ length: size }, () => Math.random() * 10 + 55);
        
        const startTime = performance.now();
        const result = StatisticalAnalysisService.independentTTest(group1, group2);
        const endTime = performance.now();
        
        const executionTime = endTime - startTime;
        
        expect(result.testStatistic).toBeDefined();
        expect(result.pValue).toBeDefined();
        expect(executionTime).toBeLessThan(size < 10000 ? 1000 : 5000);
      });

      it(`should perform ANOVA efficiently with ${size} samples`, () => {
        const groups = [
          Array.from({ length: Math.floor(size / 3) }, () => Math.random() * 10 + 50),
          Array.from({ length: Math.floor(size / 3) }, () => Math.random() * 10 + 55),
          Array.from({ length: Math.floor(size / 3) }, () => Math.random() * 10 + 60)
        ];
        
        const startTime = performance.now();
        const result = StatisticalAnalysisService.oneWayANOVA(groups);
        const endTime = performance.now();
        
        const executionTime = endTime - startTime;
        
        expect(result.fStatistic).toBeDefined();
        expect(result.pValue).toBeDefined();
        expect(executionTime).toBeLessThan(size < 10000 ? 2000 : 10000);
      });

      it(`should perform correlation analysis efficiently with ${size} samples`, () => {
        const x = Array.from({ length: size }, () => Math.random() * 100);
        const y = Array.from({ length: size }, (_, i) => x[i] * 0.8 + Math.random() * 20);
        
        const startTime = performance.now();
        const result = StatisticalAnalysisService.pearsonCorrelation(x, y);
        const endTime = performance.now();
        
        const executionTime = endTime - startTime;
        
        expect(result.coefficient).toBeDefined();
        expect(result.pValue).toBeDefined();
        expect(executionTime).toBeLessThan(size < 10000 ? 500 : 2000);
      });

      it(`should perform regression analysis efficiently with ${size} samples`, () => {
        const x = Array.from({ length: size }, () => Math.random() * 100);
        const y = Array.from({ length: size }, (_, i) => x[i] * 2 + Math.random() * 10);
        
        const startTime = performance.now();
        const result = StatisticalAnalysisService.simpleLinearRegression(x, y);
        const endTime = performance.now();
        
        const executionTime = endTime - startTime;
        
        expect(result.slope).toBeDefined();
        expect(result.intercept).toBeDefined();
        expect(result.rSquared).toBeDefined();
        expect(executionTime).toBeLessThan(size < 10000 ? 1000 : 3000);
      });
    });
  });

  describe('Data Import Performance', () => {
    it('should import large CSV files efficiently', async () => {
      const rowCount = 50000;
      const csvContent = generateLargeCsvContent(rowCount);
      const filePath = path.join(testDataDir, 'large-test.csv');
      
      fs.writeFileSync(filePath, csvContent);
      
      const startTime = performance.now();
      const result = await DataImportService.importFromFile(filePath, 'large-test.csv', {
        hasHeader: true,
        delimiter: ','
      });
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(result.data.length).toBe(rowCount);
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.metadata.rowCount).toBe(rowCount);
    });

    it('should handle concurrent file imports', async () => {
      const fileCount = 5;
      const rowsPerFile = 1000;
      const promises = [];
      
      // Create multiple test files
      for (let i = 0; i < fileCount; i++) {
        const csvContent = generateLargeCsvContent(rowsPerFile);
        const filePath = path.join(testDataDir, `concurrent-test-${i}.csv`);
        fs.writeFileSync(filePath, csvContent);
        
        promises.push(
          DataImportService.importFromFile(filePath, `concurrent-test-${i}.csv`, {
            hasHeader: true,
            delimiter: ','
          })
        );
      }
      
      const startTime = performance.now();
      const results = await Promise.all(promises);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(results.length).toBe(fileCount);
      results.forEach(result => {
        expect(result.data.length).toBe(rowsPerFile);
      });
      expect(executionTime).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });

  describe('Data Preprocessing Performance', () => {
    it('should handle missing value imputation efficiently', () => {
      const size = 10000;
      const data = Array.from({ length: size }, (_, i) => 
        i % 10 === 0 ? null : Math.random() * 100
      ) as (number | null)[];
      
      const startTime = performance.now();
      const result = DataPreprocessingService.handleMissingValues(data, 'mean');
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(result.filter(x => x !== null).length).toBe(size);
      expect(executionTime).toBeLessThan(1000);
    });

    it('should detect outliers efficiently in large datasets', () => {
      const size = 50000;
      const data = Array.from({ length: size }, () => Math.random() * 100);
      // Add some outliers
      data.push(1000, 2000, -1000);
      
      const startTime = performance.now();
      const outliers = DataPreprocessingService.detectOutliers(data);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(outliers.outliers.length).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(2000);
    });

    it('should perform data transformations efficiently', () => {
      const size = 25000;
      const data = Array.from({ length: size }, () => Math.random() * 100 + 1);
      
      const startTime = performance.now();
      const logTransformed = DataPreprocessingService.transformData(data, 'log');
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(logTransformed.length).toBe(size);
      expect(executionTime).toBeLessThan(1000);
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle multiple statistical analyses concurrently', async () => {
      const dataSize = 5000;
      const concurrentOperations = 10;
      
      const testData = Array.from({ length: dataSize }, () => Math.random() * 100);
      
      const operations = Array.from({ length: concurrentOperations }, (_, i) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            const startTime = performance.now();
            const stats = StatisticalAnalysisService.calculateDescriptiveStats(testData);
            const endTime = performance.now();
            resolve({
              operationId: i,
              executionTime: endTime - startTime,
              result: stats
            });
          }, Math.random() * 100); // Random delay to simulate real-world conditions
        });
      });
      
      const startTime = performance.now();
      const results = await Promise.all(operations);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      
      expect(results.length).toBe(concurrentOperations);
      results.forEach((result: any) => {
        expect(result.result.count).toBe(dataSize);
        expect(result.executionTime).toBeLessThan(1000);
      });
      expect(totalTime).toBeLessThan(5000);
    });

    it('should maintain performance under memory pressure', () => {
      const iterations = 100;
      const dataSize = 1000;
      const executionTimes: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const data = Array.from({ length: dataSize }, () => Math.random() * 100);
        
        const startTime = performance.now();
        const stats = StatisticalAnalysisService.calculateDescriptiveStats(data);
        const endTime = performance.now();
        
        executionTimes.push(endTime - startTime);
        
        expect(stats.count).toBe(dataSize);
      }
      
      // Check that performance doesn't degrade significantly over iterations
      const firstHalf = executionTimes.slice(0, 50);
      const secondHalf = executionTimes.slice(50);
      
      const firstHalfAvg = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b) / secondHalf.length;
      
      // Second half shouldn't be more than 50% slower than first half
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.5);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not leak memory during repeated operations', () => {
      const initialMemory = process.memoryUsage();
      const iterations = 1000;
      const dataSize = 1000;
      
      for (let i = 0; i < iterations; i++) {
        const data = Array.from({ length: dataSize }, () => Math.random() * 100);
        const stats = StatisticalAnalysisService.calculateDescriptiveStats(data);
        
        // Force garbage collection periodically
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }
      
      // Force final garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be minimal (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle large arrays without excessive memory allocation', () => {
      const size = 100000;
      const initialMemory = process.memoryUsage();
      
      // Create large array
      const data = new Array(size);
      for (let i = 0; i < size; i++) {
        data[i] = Math.random() * 100;
      }
      
      const afterCreationMemory = process.memoryUsage();
      
      // Perform analysis
      const stats = StatisticalAnalysisService.calculateDescriptiveStats(data);
      
      const finalMemory = process.memoryUsage();
      
      const creationMemoryIncrease = afterCreationMemory.heapUsed - initialMemory.heapUsed;
      const analysisMemoryIncrease = finalMemory.heapUsed - afterCreationMemory.heapUsed;
      
      expect(stats.count).toBe(size);
      // Analysis shouldn't use more than 2x the data size in additional memory
      expect(analysisMemoryIncrease).toBeLessThan(creationMemoryIncrease * 2);
    });
  });
});

// Helper functions
function generateTestData(rowCount: number) {
  const values = Array.from({ length: rowCount }, () => Math.random() * 100);
  const categories = Array.from({ length: rowCount }, (_, i) => `Category${i % 10}`);
  
  return { values, categories };
}

function generateLargeCsvContent(rowCount: number): string {
  const headers = 'id,name,age,score,category,date,value1,value2,value3';
  const rows = [headers];
  
  for (let i = 1; i <= rowCount; i++) {
    const row = [
      i,
      `User${i}`,
      Math.floor(Math.random() * 50) + 20,
      Math.floor(Math.random() * 100),
      `Category${i % 5}`,
      new Date(2020 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
      Math.random() * 1000,
      Math.random() * 500,
      Math.random() * 200
    ].join(',');
    
    rows.push(row);
  }
  
  return rows.join('\n');
}