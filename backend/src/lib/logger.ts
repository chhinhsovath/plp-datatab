import winston from 'winston';
import path from 'path';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define log colors
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

winston.addColors(logColors);

// Create log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Create JSON format for production
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? jsonFormat : logFormat
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: jsonFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: jsonFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  })
];

// Add daily rotate file transport for production
if (process.env.NODE_ENV === 'production') {
  const DailyRotateFile = require('winston-daily-rotate-file');
  
  transports.push(
    new DailyRotateFile({
      filename: path.join(process.cwd(), 'logs', 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: jsonFormat
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  format: jsonFormat,
  transports,
  exitOnError: false
});

// Create structured logging methods
export const structuredLogger = {
  error: (message: string, meta?: any) => {
    logger.error(message, { ...meta, timestamp: new Date().toISOString() });
  },
  
  warn: (message: string, meta?: any) => {
    logger.warn(message, { ...meta, timestamp: new Date().toISOString() });
  },
  
  info: (message: string, meta?: any) => {
    logger.info(message, { ...meta, timestamp: new Date().toISOString() });
  },
  
  http: (message: string, meta?: any) => {
    logger.http(message, { ...meta, timestamp: new Date().toISOString() });
  },
  
  debug: (message: string, meta?: any) => {
    logger.debug(message, { ...meta, timestamp: new Date().toISOString() });
  },
  
  // Specific logging methods for different types of events
  userAction: (userId: string, action: string, details?: any) => {
    logger.info('User action', {
      type: 'user_action',
      userId,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  },
  
  apiRequest: (method: string, url: string, statusCode: number, responseTime: number, userId?: string) => {
    logger.http('API request', {
      type: 'api_request',
      method,
      url,
      statusCode,
      responseTime,
      userId,
      timestamp: new Date().toISOString()
    });
  },
  
  databaseQuery: (query: string, duration: number, error?: string) => {
    logger.debug('Database query', {
      type: 'database_query',
      query: query.substring(0, 100), // Truncate long queries
      duration,
      error,
      timestamp: new Date().toISOString()
    });
  },
  
  securityEvent: (event: string, userId?: string, ip?: string, details?: any) => {
    logger.warn('Security event', {
      type: 'security_event',
      event,
      userId,
      ip,
      details,
      timestamp: new Date().toISOString()
    });
  },
  
  performanceMetric: (metric: string, value: number, unit: string, context?: any) => {
    logger.info('Performance metric', {
      type: 'performance_metric',
      metric,
      value,
      unit,
      context,
      timestamp: new Date().toISOString()
    });
  }
};

export default logger;