export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryCondition?: (error: Error) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
}

export class RetryError extends Error {
  public readonly attempts: number;
  public readonly lastError: Error;

  constructor(message: string, attempts: number, lastError: Error) {
    super(message);
    this.name = 'RetryError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

const defaultRetryOptions: RetryOptions = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryCondition: (error: Error) => {
    // Retry on network errors, timeouts, and 5xx server errors
    return (
      error.message.includes('ECONNRESET') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('ECONNREFUSED') ||
      (error as any).status >= 500
    );
  }
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config = { ...defaultRetryOptions, ...options };
  let lastError: Error;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry if this is the last attempt
      if (attempt === config.maxAttempts) {
        break;
      }
      
      // Check if we should retry this error
      if (config.retryCondition && !config.retryCondition(lastError)) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffFactor, attempt - 1),
        config.maxDelay
      );
      
      // Add jitter to prevent thundering herd
      const jitteredDelay = delay + Math.random() * 1000;
      
      // Call retry callback if provided
      if (config.onRetry) {
        config.onRetry(lastError, attempt);
      }
      
      console.warn(`Operation failed (attempt ${attempt}/${config.maxAttempts}), retrying in ${Math.round(jitteredDelay)}ms:`, lastError.message);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, jitteredDelay));
    }
  }
  
  throw new RetryError(
    `Operation failed after ${config.maxAttempts} attempts`,
    config.maxAttempts,
    lastError!
  );
}

// Specialized retry functions for different scenarios

export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  return withRetry(operation, {
    maxAttempts,
    baseDelay: 500,
    maxDelay: 5000,
    retryCondition: (error: Error) => {
      // Retry on connection errors and timeouts
      return (
        error.message.includes('connection') ||
        error.message.includes('timeout') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('P1001') || // Prisma connection error
        error.message.includes('P1008') || // Prisma timeout
        error.message.includes('P1017')    // Prisma server not reachable
      );
    },
    onRetry: (error, attempt) => {
      console.warn(`Database operation retry ${attempt}:`, error.message);
    }
  });
}

export async function withNetworkRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  return withRetry(operation, {
    maxAttempts,
    baseDelay: 1000,
    maxDelay: 10000,
    retryCondition: (error: Error) => {
      // Retry on network errors and 5xx responses
      return (
        error.message.includes('ECONNRESET') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ECONNREFUSED') ||
        (error as any).status >= 500
      );
    },
    onRetry: (error, attempt) => {
      console.warn(`Network operation retry ${attempt}:`, error.message);
    }
  });
}

export async function withStatisticalRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 2
): Promise<T> {
  return withRetry(operation, {
    maxAttempts,
    baseDelay: 100,
    maxDelay: 1000,
    retryCondition: (error: Error) => {
      // Retry on numerical computation errors that might be transient
      return (
        error.message.includes('numerical instability') ||
        error.message.includes('convergence') ||
        error.message.includes('precision')
      );
    },
    onRetry: (error, attempt) => {
      console.warn(`Statistical computation retry ${attempt}:`, error.message);
    }
  });
}