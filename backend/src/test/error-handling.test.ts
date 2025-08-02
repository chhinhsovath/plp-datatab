import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { 
  errorHandler, 
  notFoundHandler, 
  CustomError, 
  ValidationError, 
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  StatisticalError,
  DataProcessingError,
  asyncHandler
} from '../middleware/error-handler.js';
import { errorLogger } from '../lib/error-logger.js';

// Mock error logger
vi.mock('../lib/error-logger.js', () => ({
  errorLogger: {
    logError: vi.fn().mockReturnValue('test-error-id'),
    logWarning: vi.fn().mockReturnValue('test-warning-id'),
    logInfo: vi.fn().mockReturnValue('test-info-id'),
  }
}));

describe('Error Handling Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Custom Error Classes', () => {
    it('should create CustomError with correct properties', () => {
      const error = new CustomError('Test error', 400, 'TEST_ERROR');
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('CustomError');
    });

    it('should create ValidationError with default status code', () => {
      const error = new ValidationError('Validation failed');
      
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ValidationError');
    });

    it('should create AuthenticationError with default message', () => {
      const error = new AuthenticationError();
      
      expect(error.message).toBe('Authentication required');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('should create StatisticalError with custom code', () => {
      const error = new StatisticalError('Insufficient data', 'INSUFFICIENT_DATA');
      
      expect(error.message).toBe('Insufficient data');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('INSUFFICIENT_DATA');
      expect(error.name).toBe('StatisticalError');
    });
  });

  describe('Error Handler Middleware', () => {
    it('should handle CustomError correctly', async () => {
      app.get('/test', (req, res, next) => {
        next(new ValidationError('Invalid input', { field: 'email' }));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Invalid input');
      expect(response.body.error.details).toEqual({ field: 'email' });
      expect(response.body.error.timestamp).toBeDefined();
      expect(response.body.error.requestId).toBeDefined();
    });

    it('should handle ZodError correctly', async () => {
      app.get('/test', (req, res, next) => {
        const zodError = new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['email'],
            message: 'Expected string, received number'
          }
        ]);
        next(zodError);
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Input validation failed');
      expect(response.body.error.details).toBeDefined();
    });

    it('should handle MulterError correctly', async () => {
      app.get('/test', (req, res, next) => {
        const multerError = new MulterError('LIMIT_FILE_SIZE', 'file');
        next(multerError);
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('FILE_TOO_LARGE');
      expect(response.body.error.message).toBe('File size exceeds the maximum allowed limit');
    });

    it('should handle PrismaClientKnownRequestError correctly', async () => {
      app.get('/test', (req, res, next) => {
        const prismaError = new PrismaClientKnownRequestError(
          'Unique constraint failed',
          {
            code: 'P2002',
            clientVersion: '4.0.0',
            meta: { target: ['email'] }
          }
        );
        next(prismaError);
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('DUPLICATE_RECORD');
      expect(response.body.error.message).toBe('A record with this information already exists');
    });

    it('should handle generic errors correctly', async () => {
      app.get('/test', (req, res, next) => {
        next(new Error('Generic error'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(response.body.error.message).toBe('Generic error');
    });

    it('should not include stack trace in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      app.get('/test', (req, res, next) => {
        next(new Error('Test error'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.body.error.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should include stack trace in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      app.get('/test', (req, res, next) => {
        next(new Error('Test error'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.body.error.stack).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Not Found Handler', () => {
    it('should handle 404 errors correctly', async () => {
      app.use(notFoundHandler);

      const response = await request(app).get('/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
      expect(response.body.error.message).toBe('Route GET /nonexistent not found');
      expect(response.body.error.timestamp).toBeDefined();
      expect(response.body.error.requestId).toBeDefined();
    });
  });

  describe('Async Handler Wrapper', () => {
    it('should catch async errors and pass to error handler', async () => {
      const asyncRoute = asyncHandler(async (req, res, next) => {
        throw new ValidationError('Async validation error');
      });

      app.get('/test', asyncRoute);
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Async validation error');
    });

    it('should handle successful async operations', async () => {
      const asyncRoute = asyncHandler(async (req, res, next) => {
        res.json({ success: true });
      });

      app.get('/test', asyncRoute);
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Logging', () => {
    it('should log errors to console in development', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      app.get('/test', (req, res, next) => {
        next(new Error('Test error for logging'));
      });
      app.use(errorHandler);

      await request(app).get('/test');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error response format', async () => {
      app.get('/test', (req, res, next) => {
        next(new CustomError('Test error', 400, 'TEST_CODE'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('timestamp');
      expect(response.body.error).toHaveProperty('requestId');
      
      expect(typeof response.body.error.code).toBe('string');
      expect(typeof response.body.error.message).toBe('string');
      expect(typeof response.body.error.timestamp).toBe('string');
      expect(typeof response.body.error.requestId).toBe('string');
    });
  });

  describe('Statistical Error Handling', () => {
    it('should handle statistical errors with appropriate codes', async () => {
      app.get('/test', (req, res, next) => {
        next(new StatisticalError('Insufficient data for analysis', 'INSUFFICIENT_DATA'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INSUFFICIENT_DATA');
      expect(response.body.error.message).toBe('Insufficient data for analysis');
    });

    it('should handle data processing errors', async () => {
      app.get('/test', (req, res, next) => {
        next(new DataProcessingError('Invalid data format', 'INVALID_FORMAT'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_FORMAT');
      expect(response.body.error.message).toBe('Invalid data format');
    });
  });

  describe('HTTP Status Code Mapping', () => {
    const testCases = [
      { ErrorClass: ValidationError, expectedStatus: 400 },
      { ErrorClass: AuthenticationError, expectedStatus: 401 },
      { ErrorClass: AuthorizationError, expectedStatus: 403 },
      { ErrorClass: NotFoundError, expectedStatus: 404 },
      { ErrorClass: ConflictError, expectedStatus: 409 },
      { ErrorClass: StatisticalError, expectedStatus: 400 },
      { ErrorClass: DataProcessingError, expectedStatus: 400 },
    ];

    testCases.forEach(({ ErrorClass, expectedStatus }) => {
      it(`should return ${expectedStatus} for ${ErrorClass.name}`, async () => {
        app.get('/test', (req, res, next) => {
          next(new ErrorClass('Test error'));
        });
        app.use(errorHandler);

        const response = await request(app).get('/test');

        expect(response.status).toBe(expectedStatus);
      });
    });
  });
});