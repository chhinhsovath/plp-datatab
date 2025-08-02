import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { initializeDatabase, prisma } from '../lib/database.js';
import uploadRoutes from '../routes/upload.js';
import { generateToken } from '../lib/auth.js';

const app = express();
app.use(express.json());
app.use('/api/upload', uploadRoutes);

describe('Upload Routes', () => {
  let testUser: any;
  let authToken: string;
  let testProject: any;
  const testDataDir = path.join(process.cwd(), 'test-data');
  const uploadsDir = path.join(process.cwd(), 'uploads');

  beforeAll(async () => {
    await initializeDatabase();
    
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashedpassword'
      }
    });

    authToken = generateToken(testUser.id);

    // Create test project
    testProject = await prisma.project.create({
      data: {
        name: 'Test Project',
        description: 'Test project for upload tests',
        ownerId: testUser.id
      }
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.dataset.deleteMany({ where: { userId: testUser.id } });
    await prisma.project.deleteMany({ where: { ownerId: testUser.id } });
    await prisma.user.deleteMany({ where: { email: 'test@example.com' } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    // Create test directories
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
    // Don't clean uploads directory as it might contain files from other tests
  });

  describe('POST /api/upload/file', () => {
    it('should upload and import CSV file successfully', async () => {
      const csvContent = `name,age,city
John Doe,30,New York
Jane Smith,25,Los Angeles`;

      const filePath = path.join(testDataDir, 'test.csv');
      fs.writeFileSync(filePath, csvContent);

      const response = await request(app)
        .post('/api/upload/file')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', filePath)
        .field('hasHeader', 'true')
        .field('projectId', testProject.id);

      expect(response.status).toBe(200);
      expect(response.body.dataset).toBeDefined();
      expect(response.body.dataset.name).toBe('test');
      expect(response.body.preview).toHaveLength(2);
      expect(response.body.dataset.metadata.fileType).toBe('csv');
      expect(response.body.dataset.metadata.columns).toHaveLength(3);
    });

    it('should reject file upload without authentication', async () => {
      const csvContent = `name,age\nJohn,30`;
      const filePath = path.join(testDataDir, 'test.csv');
      fs.writeFileSync(filePath, csvContent);

      const response = await request(app)
        .post('/api/upload/file')
        .attach('file', filePath);

      expect(response.status).toBe(401);
    });

    it('should reject unsupported file formats', async () => {
      const txtContent = 'This is a text file';
      const filePath = path.join(testDataDir, 'test.txt');
      fs.writeFileSync(filePath, txtContent);

      const response = await request(app)
        .post('/api/upload/file')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', filePath);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Unsupported file format');
    });

    it('should reject empty file uploads', async () => {
      const response = await request(app)
        .post('/api/upload/file')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No file uploaded');
    });

    it('should handle CSV with custom delimiter', async () => {
      const csvContent = `name;age;city
John Doe;30;New York`;

      const filePath = path.join(testDataDir, 'test-semicolon.csv');
      fs.writeFileSync(filePath, csvContent);

      const response = await request(app)
        .post('/api/upload/file')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', filePath)
        .field('delimiter', ';');

      expect(response.status).toBe(200);
      expect(response.body.preview[0]).toEqual({
        name: 'John Doe',
        age: '30',
        city: 'New York'
      });
    });

    it('should handle JSON file upload', async () => {
      const jsonData = [
        { name: 'John Doe', age: 30 },
        { name: 'Jane Smith', age: 25 }
      ];

      const filePath = path.join(testDataDir, 'test.json');
      fs.writeFileSync(filePath, JSON.stringify(jsonData));

      const response = await request(app)
        .post('/api/upload/file')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', filePath);

      expect(response.status).toBe(200);
      expect(response.body.dataset.metadata.fileType).toBe('json');
      expect(response.body.preview).toHaveLength(2);
    });
  });

  describe('POST /api/upload/url', () => {
    it('should reject URL import without authentication', async () => {
      const response = await request(app)
        .post('/api/upload/url')
        .send({
          url: 'https://example.com/data.csv',
          name: 'Test Dataset'
        });

      expect(response.status).toBe(401);
    });

    it('should validate URL format', async () => {
      const response = await request(app)
        .post('/api/upload/url')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'invalid-url',
          name: 'Test Dataset'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request parameters');
    });

    it('should require name field', async () => {
      const response = await request(app)
        .post('/api/upload/url')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://example.com/data.csv'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request parameters');
    });

    it('should handle network errors gracefully', async () => {
      const response = await request(app)
        .post('/api/upload/url')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://nonexistent-domain-12345.com/data.csv',
          name: 'Test Dataset'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed to import from URL');
    });
  });

  describe('POST /api/upload/excel-sheets', () => {
    it('should reject non-Excel files', async () => {
      const csvContent = `name,age\nJohn,30`;
      const filePath = path.join(testDataDir, 'test.csv');
      fs.writeFileSync(filePath, csvContent);

      const response = await request(app)
        .post('/api/upload/excel-sheets')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', filePath);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('File must be an Excel file (.xlsx or .xls)');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/upload/excel-sheets');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/upload/datasets', () => {
    it('should return user datasets', async () => {
      // First upload a dataset
      const csvContent = `name,age\nJohn,30`;
      const filePath = path.join(testDataDir, 'test.csv');
      fs.writeFileSync(filePath, csvContent);

      await request(app)
        .post('/api/upload/file')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', filePath);

      // Then get datasets
      const response = await request(app)
        .get('/api/upload/datasets')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.datasets).toBeDefined();
      expect(Array.isArray(response.body.datasets)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/upload/datasets');

      expect(response.status).toBe(401);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/upload/datasets?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });
  });

  describe('GET /api/upload/dataset/:id/data', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/upload/dataset/nonexistent/data');

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent dataset', async () => {
      const response = await request(app)
        .get('/api/upload/dataset/nonexistent/data')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Dataset not found');
    });
  });

  describe('DELETE /api/upload/dataset/:id', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/upload/dataset/nonexistent');

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent dataset', async () => {
      const response = await request(app)
        .delete('/api/upload/dataset/nonexistent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Dataset not found or access denied');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed CSV files', async () => {
      const malformedCsv = `name,age,city
John Doe,30,New York
Jane Smith,25,Los Angeles,Extra Field
Bob Johnson,35`; // Missing field

      const filePath = path.join(testDataDir, 'malformed.csv');
      fs.writeFileSync(filePath, malformedCsv);

      const response = await request(app)
        .post('/api/upload/file')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', filePath);

      // Should still succeed but handle the malformed data gracefully
      expect(response.status).toBe(200);
    });

    it('should handle empty CSV files', async () => {
      const filePath = path.join(testDataDir, 'empty.csv');
      fs.writeFileSync(filePath, '');

      const response = await request(app)
        .post('/api/upload/file')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', filePath);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('File is empty');
    });

    it('should handle invalid JSON files', async () => {
      const filePath = path.join(testDataDir, 'invalid.json');
      fs.writeFileSync(filePath, '{ invalid json }');

      const response = await request(app)
        .post('/api/upload/file')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', filePath);

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('JSON parsing error');
    });
  });
});