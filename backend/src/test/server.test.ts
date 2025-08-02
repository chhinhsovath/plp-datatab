import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from '../routes/auth.js';

// Create test app similar to main server
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString() 
  });
});

// API routes
app.get('/api/status', (_req, res) => {
  res.json({ 
    message: 'DataTab Clone API is running',
    version: '1.0.0',
    environment: 'test'
  });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

describe('Server Integration', () => {
  it('should respond to health check', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('OK');
    expect(response.body.timestamp).toBeDefined();
  });

  it('should respond to status endpoint', async () => {
    const response = await request(app)
      .get('/api/status')
      .expect(200);

    expect(response.body.message).toBe('DataTab Clone API is running');
    expect(response.body.version).toBe('1.0.0');
    expect(response.body.environment).toBe('test');
  });

  it('should handle 404 for unknown routes', async () => {
    const response = await request(app)
      .get('/unknown-route')
      .expect(404);

    expect(response.body.error).toBe('Route not found');
  });

  it('should have authentication routes available', async () => {
    // Test that auth routes are mounted (will fail due to validation, but route exists)
    await request(app)
      .post('/api/auth/register')
      .send({})
      .expect(400); // Validation error, but route exists

    await request(app)
      .post('/api/auth/login')
      .send({})
      .expect(400); // Validation error, but route exists

    await request(app)
      .get('/api/auth/me')
      .expect(401); // No token, but route exists
  });
});