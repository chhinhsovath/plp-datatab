import fs from 'fs';
import path from 'path';
import { Request } from 'express';

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  request?: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
    query?: any;
    params?: any;
    ip: string;
    userAgent?: string;
    userId?: string;
  };
  context?: Record<string, any>;
  tags?: string[];
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByEndpoint: Record<string, number>;
  errorsByUser: Record<string, number>;
  recentErrors: ErrorLogEntry[];
  errorRate: number;
  averageResponseTime: number;
}

class ErrorLogger {
  private logDir: string;
  private maxLogFiles: number = 30;
  private maxLogSize: number = 10 * 1024 * 1024; // 10MB
  private errorMetrics: ErrorMetrics;
  private metricsWindow: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
    this.initializeMetrics();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private initializeMetrics(): void {
    this.errorMetrics = {
      totalErrors: 0,
      errorsByType: {},
      errorsByEndpoint: {},
      errorsByUser: {},
      recentErrors: [],
      errorRate: 0,
      averageResponseTime: 0
    };
  }

  private generateId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getLogFileName(): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `error-${date}.log`);
  }

  private rotateLogsIfNeeded(): void {
    const logFile = this.getLogFileName();
    
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      if (stats.size > this.maxLogSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = path.join(this.logDir, `error-${timestamp}.log`);
        fs.renameSync(logFile, rotatedFile);
      }
    }

    // Clean up old log files
    this.cleanupOldLogs();
  }

  private cleanupOldLogs(): void {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(file => file.startsWith('error-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file),
          mtime: fs.statSync(path.join(this.logDir, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Keep only the most recent files
      if (files.length > this.maxLogFiles) {
        const filesToDelete = files.slice(this.maxLogFiles);
        filesToDelete.forEach(file => {
          fs.unlinkSync(file.path);
        });
      }
    } catch (error) {
      console.error('Error cleaning up log files:', error);
    }
  }

  private writeToFile(entry: ErrorLogEntry): void {
    try {
      this.rotateLogsIfNeeded();
      const logFile = this.getLogFileName();
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private updateMetrics(entry: ErrorLogEntry): void {
    this.errorMetrics.totalErrors++;
    
    // Update error counts by type
    const errorType = entry.error?.name || 'Unknown';
    this.errorMetrics.errorsByType[errorType] = (this.errorMetrics.errorsByType[errorType] || 0) + 1;
    
    // Update error counts by endpoint
    if (entry.request?.url) {
      const endpoint = `${entry.request.method} ${entry.request.url}`;
      this.errorMetrics.errorsByEndpoint[endpoint] = (this.errorMetrics.errorsByEndpoint[endpoint] || 0) + 1;
    }
    
    // Update error counts by user
    if (entry.request?.userId) {
      this.errorMetrics.errorsByUser[entry.request.userId] = (this.errorMetrics.errorsByUser[entry.request.userId] || 0) + 1;
    }
    
    // Add to recent errors (keep last 100)
    this.errorMetrics.recentErrors.unshift(entry);
    if (this.errorMetrics.recentErrors.length > 100) {
      this.errorMetrics.recentErrors = this.errorMetrics.recentErrors.slice(0, 100);
    }
    
    // Calculate error rate (errors per hour in the last 24 hours)
    const now = Date.now();
    const recentErrorsInWindow = this.errorMetrics.recentErrors.filter(
      e => now - new Date(e.timestamp).getTime() < this.metricsWindow
    );
    this.errorMetrics.errorRate = recentErrorsInWindow.length / 24; // errors per hour
  }

  public logError(
    error: Error,
    req?: Request,
    context?: Record<string, any>,
    tags?: string[]
  ): string {
    const entry: ErrorLogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level: 'error',
      message: error.message,
      error: {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        code: (error as any).code
      },
      context,
      tags
    };

    if (req) {
      entry.request = {
        method: req.method,
        url: req.url,
        headers: this.sanitizeHeaders(req.headers as Record<string, string>),
        body: this.sanitizeBody(req.body),
        query: req.query,
        params: req.params,
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent'),
        userId: (req as any).user?.userId
      };
    }

    this.writeToFile(entry);
    this.updateMetrics(entry);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${entry.id}] ${entry.message}`, entry);
    }

    return entry.id;
  }

  public logWarning(
    message: string,
    req?: Request,
    context?: Record<string, any>,
    tags?: string[]
  ): string {
    const entry: ErrorLogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      context,
      tags
    };

    if (req) {
      entry.request = {
        method: req.method,
        url: req.url,
        headers: this.sanitizeHeaders(req.headers as Record<string, string>),
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent'),
        userId: (req as any).user?.userId
      };
    }

    this.writeToFile(entry);
    return entry.id;
  }

  public logInfo(
    message: string,
    req?: Request,
    context?: Record<string, any>,
    tags?: string[]
  ): string {
    const entry: ErrorLogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      context,
      tags
    };

    if (req) {
      entry.request = {
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userId: (req as any).user?.userId
      };
    }

    this.writeToFile(entry);
    return entry.id;
  }

  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  public getMetrics(): ErrorMetrics {
    return { ...this.errorMetrics };
  }

  public getErrorById(id: string): ErrorLogEntry | null {
    return this.errorMetrics.recentErrors.find(entry => entry.id === id) || null;
  }

  public searchErrors(
    filters: {
      level?: 'error' | 'warn' | 'info';
      errorType?: string;
      endpoint?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
      tags?: string[];
    },
    limit: number = 50
  ): ErrorLogEntry[] {
    let results = [...this.errorMetrics.recentErrors];

    if (filters.level) {
      results = results.filter(entry => entry.level === filters.level);
    }

    if (filters.errorType) {
      results = results.filter(entry => entry.error?.name === filters.errorType);
    }

    if (filters.endpoint) {
      results = results.filter(entry => 
        entry.request && `${entry.request.method} ${entry.request.url}` === filters.endpoint
      );
    }

    if (filters.userId) {
      results = results.filter(entry => entry.request?.userId === filters.userId);
    }

    if (filters.startDate) {
      results = results.filter(entry => 
        new Date(entry.timestamp) >= filters.startDate!
      );
    }

    if (filters.endDate) {
      results = results.filter(entry => 
        new Date(entry.timestamp) <= filters.endDate!
      );
    }

    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(entry => 
        entry.tags && filters.tags!.some(tag => entry.tags!.includes(tag))
      );
    }

    return results.slice(0, limit);
  }

  public clearMetrics(): void {
    this.initializeMetrics();
  }
}

// Singleton instance
export const errorLogger = new ErrorLogger();