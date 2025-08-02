import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import preprocessingRoutes from '../routes/preprocessing.js';

describe('Preprocessing API', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/preprocessing', preprocessingRoutes);
  });

  const sampleData = [
    { id: 1, name: 'Alice', age: 25, salary: 50000, active: true },
    { id: 2, name: 'Bob', age: 30, salary: 60000, active: false },
    { id: 3, name: 'Charlie', age: null, salary: 70000, active: true },
    { id: 4, name: 'David', age: 35, salary: null, active: false }
  ];

  describe('POST /api/preprocessing/convert-types', () => {
    it('should convert data types successfully', async () => {
      const response = await request(app)
        .post('/api/preprocessing/convert-types')
        .send({
          data: [{ value: '123' }, { value: '456' }],
          conversions: [{
            column: 'value',
            targetType: 'numeric'
          }]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data[0].value).toBe(123);
      expect(response.body.data[1].value).toBe(456);
    });

    it('should return validation error for invalid request', async () => {
      const response = await request(app)
        .post('/api/preprocessing/convert-types')
        .send({
          data: 'invalid',
          conversions: []
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/preprocessing/handle-missing', () => {
    it('should handle missing values with mean strategy', async () => {
      const response = await request(app)
        .post('/api/preprocessing/handle-missing')
        .send({
          data: sampleData,
          strategy: 'fill_mean',
          columns: ['age']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data[2].age).toBe(30); // Mean of 25, 30, 35
    });

    it('should remove rows with missing values', async () => {
      const response = await request(app)
        .post('/api/preprocessing/handle-missing')
        .send({
          data: sampleData,
          strategy: 'remove',
          columns: ['age']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3); // One row removed
    });
  });

  describe('POST /api/preprocessing/handle-outliers', () => {
    it('should detect and flag outliers', async () => {
      const testData = [
        { value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 },
        { value: 6 }, { value: 7 }, { value: 8 }, { value: 9 }, { value: 100 }
      ];

      const response = await request(app)
        .post('/api/preprocessing/handle-outliers')
        .send({
          data: testData,
          method: 'iqr',
          action: 'flag',
          columns: ['value']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data[9].value_outlier).toBe(true);
    });

    it('should return validation error for invalid method', async () => {
      const response = await request(app)
        .post('/api/preprocessing/handle-outliers')
        .send({
          data: sampleData,
          method: 'invalid_method',
          action: 'flag'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/preprocessing/filter-rows', () => {
    it('should filter rows based on conditions', async () => {
      const response = await request(app)
        .post('/api/preprocessing/filter-rows')
        .send({
          data: sampleData,
          filters: [{
            column: 'active',
            operator: 'equals',
            value: true
          }]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((row: any) => row.active === true)).toBe(true);
    });
  });

  describe('POST /api/preprocessing/create-variable', () => {
    it('should create new variable with formula', async () => {
      const response = await request(app)
        .post('/api/preprocessing/create-variable')
        .send({
          data: sampleData,
          newColumnName: 'age_plus_10',
          formula: 'age + 10',
          variables: { age: 'age' }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data[0].age_plus_10).toBe(35); // 25 + 10
    });

    it('should create new variable with mathematical functions', async () => {
      const response = await request(app)
        .post('/api/preprocessing/create-variable')
        .send({
          data: [{ value: 25 }, { value: 36 }],
          newColumnName: 'sqrt_value',
          formula: 'sqrt(value)',
          variables: { value: 'value' }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data[0].sqrt_value).toBe(5);
      expect(response.body.data[1].sqrt_value).toBe(6);
    });
  });

  describe('POST /api/preprocessing/remove-duplicates', () => {
    it('should remove duplicate rows', async () => {
      const testData = [
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 30 },
        { name: 'Alice', age: 25 }, // Duplicate
        { name: 'Charlie', age: 35 }
      ];

      const response = await request(app)
        .post('/api/preprocessing/remove-duplicates')
        .send({
          data: testData
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
    });
  });

  describe('POST /api/preprocessing/normalize', () => {
    it('should normalize columns using min-max scaling', async () => {
      const testData = [
        { value: 10 },
        { value: 20 },
        { value: 30 }
      ];

      const response = await request(app)
        .post('/api/preprocessing/normalize')
        .send({
          data: testData,
          columns: ['value']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data[0].value).toBe(0);
      expect(response.body.data[1].value).toBe(0.5);
      expect(response.body.data[2].value).toBe(1);
    });
  });

  describe('POST /api/preprocessing/standardize', () => {
    it('should standardize columns using z-score', async () => {
      const testData = [
        { value: 10 },
        { value: 20 },
        { value: 30 }
      ];

      const response = await request(app)
        .post('/api/preprocessing/standardize')
        .send({
          data: testData,
          columns: ['value']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data[1].value).toBeCloseTo(0, 1); // Mean should be ~0
    });
  });

  describe('POST /api/preprocessing/validate-quality', () => {
    it('should validate data quality', async () => {
      const response = await request(app)
        .post('/api/preprocessing/validate-quality')
        .send({
          data: sampleData
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.validation).toHaveProperty('isValid');
      expect(response.body.validation).toHaveProperty('issues');
      expect(response.body.validation).toHaveProperty('suggestions');
    });

    it('should identify empty dataset', async () => {
      const response = await request(app)
        .post('/api/preprocessing/validate-quality')
        .send({
          data: []
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.validation.isValid).toBe(false);
      expect(response.body.validation.issues).toContain('Dataset is empty');
    });
  });

  describe('POST /api/preprocessing/apply-operations', () => {
    it('should apply multiple operations in sequence', async () => {
      const operations = [
        {
          type: 'handle_missing',
          parameters: { strategy: 'fill_mean', columns: ['age'] }
        },
        {
          type: 'create_variable',
          parameters: {
            newColumnName: 'age_category',
            formula: 'age > 30 ? 1 : 0',
            variables: { age: 'age' }
          }
        }
      ];

      const response = await request(app)
        .post('/api/preprocessing/apply-operations')
        .send({
          data: sampleData,
          operations
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(4);
      expect(response.body.data[2].age).not.toBeNull(); // Missing age filled
      expect(response.body.data[0]).toHaveProperty('age_category'); // New column created
    });
  });
});