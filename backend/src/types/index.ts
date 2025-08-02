// Re-export all types for easier importing
export * from './database.js';
export * from './data-models.js';

// Prisma client types
export type { PrismaClient } from '@prisma/client';

// Common utility types
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export interface RequestContext {
  user?: AuthenticatedUser;
  requestId: string;
  timestamp: Date;
}