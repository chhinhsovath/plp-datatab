import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { body, validationResult, ValidationChain } from 'express-validator';
import crypto from 'crypto';
import { errorLogger } from '../lib/error-logger.js';
import { auditLogger } from '../lib/audit-logger.js';
import { securityMonitor } from '../lib/security-monitor.js';

// Rate limiting configurations
export const createRateLimit = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: message || 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      errorLogger.logError(
        new Error('Rate limit exceeded'),
        req,
        { 
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path 
        },
        ['security', 'rate-limit']
      );
      res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// General API rate limiting
export const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // limit each IP to 100 requests per windowMs
  'Too many API requests from this IP, please try again later.'
);

// Strict rate limiting for authentication endpoints
export const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // limit each IP to 5 requests per windowMs
  'Too many authentication attempts from this IP, please try again later.'
);

// File upload rate limiting
export const uploadRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  10, // limit each IP to 10 uploads per hour
  'Too many file uploads from this IP, please try again later.'
);

// Analysis rate limiting (for heavy computational tasks)
export const analysisRateLimit = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  20, // limit each IP to 20 analysis requests per 5 minutes
  'Too many analysis requests from this IP, please try again later.'
);

// Enhanced CORS configuration
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://datatab-clone.vercel.app',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      errorLogger.logError(
        new Error('CORS policy violation'),
        undefined,
        { origin, allowedOrigins },
        ['security', 'cors']
      );
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
  maxAge: 86400 // 24 hours
};

// Enhanced Helmet configuration
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for file uploads
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Remove potential XSS patterns
      let sanitized = value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/data:text\/html/gi, '')
        .replace(/data:application\/javascript/gi, '')
        .replace(/vbscript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
      
      // Remove potential command injection patterns
      sanitized = sanitized
        .replace(/[;&|`$(){}[\]]/g, '') // Remove command separators and special chars
        .replace(/\b(rm|cat|ls|pwd|whoami|id|ps|kill|sudo|su|chmod|chown)\b/gi, '') // Remove dangerous commands
        .replace(/\/etc\/passwd/gi, '') // Remove common attack targets
        .replace(/\/bin\//gi, '')
        .replace(/\/usr\/bin\//gi, '');
      
      // Remove potential SQL injection patterns
      sanitized = sanitized
        .replace(/\b(DROP|SELECT|INSERT|UPDATE|DELETE|UNION|CREATE|ALTER|EXEC)\s+(TABLE|FROM|INTO)\b/gi, '') // SQL keywords
        .replace(/\b(DROP|SELECT|INSERT|UPDATE|DELETE|UNION|CREATE|ALTER|EXEC)\b/gi, '') // SQL keywords standalone
        .replace(/--/g, '') // SQL comments
        .replace(/\/\*/g, '') // SQL block comments start
        .replace(/\*\//g, '') // SQL block comments end
        .replace(/\bOR\s+['"]*\d+['"]*\s*=\s*['"]*\d+['"]*\b/gi, '') // OR 1=1 patterns with quotes
        .replace(/\bAND\s+['"]*\d+['"]*\s*=\s*['"]*\d+['"]*\b/gi, '') // AND 1=1 patterns with quotes
        .replace(/['"]\s*OR\s*['"]/gi, '') // ' OR ' patterns
        .replace(/['"]\s*AND\s*['"]/gi, ''); // ' AND ' patterns
      
      return sanitized.trim();
    }
    if (typeof value === 'object' && value !== null) {
      const sanitized: any = Array.isArray(value) ? [] : {};
      for (const key in value) {
        sanitized[key] = sanitizeValue(value[key]);
      }
      return sanitized;
    }
    return value;
  };

  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }

  next();
};

// SQL injection prevention validation
export const validateNoSQLInjection = (fields: string[]): ValidationChain[] => {
  return fields.map(field => 
    body(field)
      .if(body(field).exists())
      .custom((value) => {
        const sqlPatterns = [
          /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
          /(--|\/\*|\*\/|;|'|"|`)/,
          /(\bOR\b|\bAND\b).*[=<>]/i
        ];
        
        const stringValue = String(value);
        for (const pattern of sqlPatterns) {
          if (pattern.test(stringValue)) {
            throw new Error(`Invalid characters detected in ${field}`);
          }
        }
        return true;
      })
  );
};

// File upload security validation
export const validateFileUpload = [
  body('filename')
    .optional()
    .isLength({ min: 1, max: 255 })
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage('Filename contains invalid characters'),
  
  body('fileType')
    .optional()
    .isIn(['csv', 'xlsx', 'xls', 'json'])
    .withMessage('Invalid file type'),
];

// Enhanced file upload security validation
export const validateFileUploadSecurity = (req: Request, res: Response, next: NextFunction) => {
  const file = req.file;
  const filename = req.body.filename || file?.originalname;
  const mimeType = file?.mimetype;
  const fileSize = file?.size;

  if (!file && !filename) {
    return next();
  }

  // Check for malicious filename patterns
  const maliciousPatterns = [
    /\.\./,                                                    // Directory traversal
    /[<>:"|?*]/,                                              // Invalid filename characters
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i,               // Windows reserved names
    /\.(exe|bat|cmd|scr|pif|com|dll|vbs|js|jar|app|deb|rpm)$/i, // Executable extensions
    /\0/,                                                     // Null bytes
    /^\./,                                                    // Hidden files
    /\.(php|asp|jsp|py|rb|pl)$/i,                            // Script files
    /%00/,                                                    // Null byte encoding
    /\.(htaccess|htpasswd)$/i,                               // Apache config files
    /web\.config$/i,                                         // IIS config files
    /\.(sh|bash|zsh|fish)$/i                                 // Shell scripts
  ];

  if (filename) {
    const baseName = filename.split('.')[0];
    const isMalicious = maliciousPatterns.some(pattern => {
      if (pattern.source.includes('CON|PRN')) {
        return pattern.test(baseName);
      }
      return pattern.test(filename);
    });

    if (isMalicious) {
      auditLogger.logFileUploadEvent(req, {
        filename,
        fileSize: fileSize || 0,
        mimeType: mimeType || 'unknown',
        success: false,
        blocked: true,
        reason: 'Malicious filename pattern detected'
      });

      return res.status(400).json({
        error: 'Invalid file',
        message: 'Filename contains potentially dangerous patterns'
      });
    }
  }

  // Validate MIME types
  const allowedMimeTypes = [
    'text/csv',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/json'
  ];

  if (mimeType && !allowedMimeTypes.includes(mimeType)) {
    auditLogger.logFileUploadEvent(req, {
      filename: filename || 'unknown',
      fileSize: fileSize || 0,
      mimeType,
      success: false,
      blocked: true,
      reason: 'Invalid MIME type'
    });

    return res.status(400).json({
      error: 'Invalid file type',
      message: 'File type not allowed'
    });
  }

  // Check file size limits (100MB max)
  const maxFileSize = 100 * 1024 * 1024; // 100MB
  if (fileSize && fileSize > maxFileSize) {
    auditLogger.logFileUploadEvent(req, {
      filename: filename || 'unknown',
      fileSize,
      mimeType: mimeType || 'unknown',
      success: false,
      blocked: true,
      reason: 'File too large'
    });

    return res.status(413).json({
      error: 'File too large',
      message: `File size exceeds maximum limit of ${maxFileSize / (1024 * 1024)}MB`
    });
  }

  // Additional content-based validation for uploaded files
  if (file && file.buffer) {
    const fileContent = file.buffer.toString('utf8', 0, Math.min(1024, file.buffer.length));
    
    // Check for malicious content patterns
    const maliciousContentPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /<iframe\b[^>]*>/gi,
      /eval\s*\(/gi,
      /document\.write/gi,
      /window\.location/gi,
      /<\?php/gi,
      /<%.*%>/gi
    ];

    const containsMaliciousContent = maliciousContentPatterns.some(pattern => 
      pattern.test(fileContent)
    );

    if (containsMaliciousContent) {
      auditLogger.logFileUploadEvent(req, {
        filename: filename || 'unknown',
        fileSize: fileSize || 0,
        mimeType: mimeType || 'unknown',
        success: false,
        blocked: true,
        reason: 'Malicious content detected in file'
      });

      return res.status(400).json({
        error: 'Invalid file content',
        message: 'File contains potentially malicious content'
      });
    }
  }

  // Log successful validation
  if (file) {
    auditLogger.logFileUploadEvent(req, {
      filename: filename || 'unknown',
      fileSize: fileSize || 0,
      mimeType: mimeType || 'unknown',
      success: true,
      blocked: false
    });
  }

  next();
};

// Request validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    errorLogger.logError(
      new Error('Validation failed'),
      req,
      { validationErrors: errors.array() },
      ['security', 'validation']
    );
    
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Add request ID for tracking
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-ID', requestId);
  req.requestId = requestId;
  
  next();
};

// HTTPS enforcement middleware
export const enforceHTTPS = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production' && !req.secure && req.get('X-Forwarded-Proto') !== 'https') {
    errorLogger.logError(
      new Error('HTTP request in production'),
      req,
      { protocol: req.protocol, headers: req.headers },
      ['security', 'https']
    );
    
    return res.redirect(301, `https://${req.get('Host')}${req.url}`);
  }
  next();
};

// API key validation middleware (for external integrations)
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.header('X-API-Key');
  const validApiKeys = process.env.API_KEYS?.split(',') || [];
  
  if (validApiKeys.length > 0 && (!apiKey || !validApiKeys.includes(apiKey))) {
    errorLogger.logError(
      new Error('Invalid API key'),
      req,
      { providedKey: apiKey ? 'provided' : 'missing' },
      ['security', 'api-key']
    );
    
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid API key required'
    });
  }
  
  next();
};

// Audit logging middleware for sensitive operations
export const auditLog = (operation: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Log the operation start
    errorLogger.logError(
      new Error(`Audit: ${operation} started`),
      req,
      { 
        operation,
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      },
      ['audit', 'security']
    );
    
    // Override res.json to log the result
    const originalJson = res.json;
    res.json = function(body: any) {
      const duration = Date.now() - startTime;
      const success = res.statusCode < 400;
      
      errorLogger.logError(
        new Error(`Audit: ${operation} ${success ? 'completed' : 'failed'}`),
        req,
        { 
          operation,
          userId: req.user?.id,
          duration,
          statusCode: res.statusCode,
          success,
          timestamp: new Date().toISOString()
        },
        ['audit', 'security']
      );
      
      return originalJson.call(this, body);
    };
    
    next();
  };
};

// Security monitoring middleware
export const securityMonitoring = (req: Request, res: Response, next: NextFunction) => {
  // Monitor request for security threats
  const riskAssessment = securityMonitor.monitorRequest(req);
  
  // Block requests from blocked IPs
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (securityMonitor.isIPBlocked(ip)) {
    auditLogger.logSecurityEvent(
      'blocked_ip_access',
      'authorization',
      'error',
      req,
      {
        resource: 'access_control',
        success: false,
        details: { blockedIP: ip }
      }
    );
    
    return res.status(403).json({
      error: 'Access denied',
      message: 'Your IP address has been blocked due to suspicious activity'
    });
  }
  
  // Add risk assessment to request for downstream middleware
  req.securityRisk = riskAssessment;
  
  next();
};

// Declare module augmentation for custom properties
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      securityRisk?: import('../lib/security-config.js').SecurityRiskAssessment;
      user?: {
        id: string;
        email: string;
        name: string;
      };
    }
  }
}