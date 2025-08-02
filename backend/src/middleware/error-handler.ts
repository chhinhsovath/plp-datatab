import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
  statusCode: number;
  code: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.name = 'CustomError';

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends CustomError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    if (details) {
      (this as any).details = details;
    }
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends CustomError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends CustomError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT_ERROR');
    this.name = 'ConflictError';
  }
}

export class StatisticalError extends CustomError {
  constructor(message: string, code: string = 'STATISTICAL_ERROR') {
    super(message, 400, code);
    this.name = 'StatisticalError';
  }
}

export class DataProcessingError extends CustomError {
  constructor(message: string, code: string = 'DATA_PROCESSING_ERROR') {
    super(message, 400, code);
    this.name = 'DataProcessingError';
  }
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
    stack?: string;
  };
}

// Generate unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Log error with context
function logError(error: Error, req: Request, requestId: string) {
  const errorInfo = {
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: (req as any).user?.userId,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error as any)
    }
  };

  console.error('Error occurred:', JSON.stringify(errorInfo, null, 2));
}

// Handle Zod validation errors
function handleZodError(error: ZodError): ErrorResponse['error'] {
  const details = error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
    received: err.received
  }));

  return {
    code: 'VALIDATION_ERROR',
    message: 'Input validation failed',
    details,
    timestamp: new Date().toISOString(),
    requestId: generateRequestId()
  };
}

// Handle Multer errors
function handleMulterError(error: MulterError): ErrorResponse['error'] {
  let message = 'File upload error';
  let code = 'FILE_UPLOAD_ERROR';

  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      message = 'File size exceeds the maximum allowed limit';
      code = 'FILE_TOO_LARGE';
      break;
    case 'LIMIT_FILE_COUNT':
      message = 'Too many files uploaded';
      code = 'TOO_MANY_FILES';
      break;
    case 'LIMIT_FIELD_KEY':
      message = 'Field name too long';
      code = 'FIELD_NAME_TOO_LONG';
      break;
    case 'LIMIT_FIELD_VALUE':
      message = 'Field value too long';
      code = 'FIELD_VALUE_TOO_LONG';
      break;
    case 'LIMIT_FIELD_COUNT':
      message = 'Too many fields';
      code = 'TOO_MANY_FIELDS';
      break;
    case 'LIMIT_UNEXPECTED_FILE':
      message = 'Unexpected file field';
      code = 'UNEXPECTED_FILE';
      break;
    default:
      message = error.message;
  }

  return {
    code,
    message,
    timestamp: new Date().toISOString(),
    requestId: generateRequestId()
  };
}

// Handle Prisma errors
function handlePrismaError(error: PrismaClientKnownRequestError | PrismaClientValidationError): ErrorResponse['error'] {
  let message = 'Database operation failed';
  let code = 'DATABASE_ERROR';
  let statusCode = 500;

  if (error instanceof PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        message = 'A record with this information already exists';
        code = 'DUPLICATE_RECORD';
        statusCode = 409;
        break;
      case 'P2025':
        message = 'Record not found';
        code = 'RECORD_NOT_FOUND';
        statusCode = 404;
        break;
      case 'P2003':
        message = 'Foreign key constraint failed';
        code = 'FOREIGN_KEY_CONSTRAINT';
        statusCode = 400;
        break;
      case 'P2014':
        message = 'Invalid ID provided';
        code = 'INVALID_ID';
        statusCode = 400;
        break;
      default:
        message = error.message;
    }
  } else if (error instanceof PrismaClientValidationError) {
    message = 'Invalid data provided to database';
    code = 'DATABASE_VALIDATION_ERROR';
    statusCode = 400;
  }

  return {
    code,
    message,
    timestamp: new Date().toISOString(),
    requestId: generateRequestId()
  };
}

// Main error handling middleware
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = generateRequestId();
  
  // Log the error using the internal logError function
  logError(error, req, requestId);

  // Handle different error types
  let errorResponse: ErrorResponse['error'];
  let statusCode = 500;

  if (error instanceof ZodError) {
    errorResponse = handleZodError(error);
    statusCode = 400;
  } else if (error instanceof MulterError) {
    errorResponse = handleMulterError(error);
    statusCode = 400;
  } else if (error instanceof PrismaClientKnownRequestError || error instanceof PrismaClientValidationError) {
    errorResponse = handlePrismaError(error);
    statusCode = error instanceof PrismaClientKnownRequestError && error.code === 'P2025' ? 404 : 
                 error instanceof PrismaClientKnownRequestError && error.code === 'P2002' ? 409 : 400;
  } else if (error instanceof CustomError) {
    statusCode = error.statusCode;
    errorResponse = {
      code: error.code,
      message: error.message,
      details: (error as any).details,
      timestamp: new Date().toISOString(),
      requestId
    };
  } else {
    // Generic error
    errorResponse = {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : error.message,
      timestamp: new Date().toISOString(),
      requestId
    };
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }

  res.status(statusCode).json({ error: errorResponse });
}

// Async error wrapper
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<any>
) {
  return (req: T, res: U, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 404 handler
export function notFoundHandler(req: Request, res: Response): void {
  const requestId = generateRequestId();
  
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date().toISOString(),
      requestId
    }
  });
}

// Graceful shutdown handler
export function gracefulShutdown(server: any) {
  return (signal: string) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close((err: Error) => {
      if (err) {
        console.error('Error during server shutdown:', err);
        process.exit(1);
      }
      
      console.log('Server closed successfully');
      process.exit(0);
    });
    
    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };
}