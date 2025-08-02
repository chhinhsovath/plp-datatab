import { Request } from 'express';

export interface SecurityConfig {
  rateLimiting: {
    general: {
      windowMs: number;
      max: number;
    };
    auth: {
      windowMs: number;
      max: number;
    };
    upload: {
      windowMs: number;
      max: number;
    };
    analysis: {
      windowMs: number;
      max: number;
    };
  };
  fileUpload: {
    maxFileSize: number;
    allowedMimeTypes: string[];
    allowedExtensions: string[];
    maliciousPatterns: RegExp[];
  };
  cors: {
    allowedOrigins: string[];
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    maxAge: number;
  };
  headers: {
    enableHSTS: boolean;
    hstsMaxAge: number;
    enableCSP: boolean;
    cspDirectives: Record<string, string[]>;
    enableXSSProtection: boolean;
    enableFrameOptions: boolean;
    enableContentTypeOptions: boolean;
  };
  encryption: {
    algorithm: string;
    keyLength: number;
    ivLength: number;
    tagLength: number;
  };
  audit: {
    enabled: boolean;
    maxEvents: number;
    maxSecurityEvents: number;
    sensitiveFields: string[];
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  validation: {
    maxRequestSize: string;
    maxUrlLength: number;
    maxHeaderSize: number;
    enableSqlInjectionProtection: boolean;
    enableXssProtection: boolean;
    enableCommandInjectionProtection: boolean;
  };
}

// Default security configuration
export const defaultSecurityConfig: SecurityConfig = {
  rateLimiting: {
    general: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
    },
    auth: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5')
    },
    upload: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX || '10')
    },
    analysis: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: parseInt(process.env.ANALYSIS_RATE_LIMIT_MAX || '20')
    }
  },
  fileUpload: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedMimeTypes: [
      'text/csv',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json'
    ],
    allowedExtensions: ['.csv', '.xlsx', '.xls', '.json', '.txt'],
    maliciousPatterns: [
      /\.\./,                                                    // Directory traversal
      /[<>:"|?*]/,                                              // Invalid filename characters
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i,               // Windows reserved names
      /\.(exe|bat|cmd|scr|pif|com|dll|vbs|js|jar|app|deb|rpm)$/i, // Executable extensions
      /\0/,                                                     // Null bytes
      /^\./,                                                    // Hidden files (except allowed)
      /\.(php|asp|jsp|py|rb|pl)$/i,                            // Script files
      /javascript:/i,                                           // JavaScript protocol
      /<script/i,                                               // Script tags
      /on\w+\s*=/i                                             // Event handlers
    ]
  },
  cors: {
    allowedOrigins: [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://datatab-clone.vercel.app',
      process.env.FRONTEND_URL
    ].filter(Boolean) as string[],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'X-Request-ID'
    ],
    exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining', 'X-Request-ID'],
    maxAge: 86400 // 24 hours
  },
  headers: {
    enableHSTS: process.env.NODE_ENV === 'production',
    hstsMaxAge: 31536000, // 1 year
    enableCSP: process.env.CSP_ENABLED !== 'false',
    cspDirectives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    },
    enableXSSProtection: true,
    enableFrameOptions: true,
    enableContentTypeOptions: true
  },
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32, // 256 bits
    ivLength: 16,  // 128 bits
    tagLength: 16  // 128 bits
  },
  audit: {
    enabled: process.env.AUDIT_LOG_ENABLED !== 'false',
    maxEvents: 10000,
    maxSecurityEvents: 5000,
    sensitiveFields: [
      'password',
      'token',
      'key',
      'secret',
      'authorization',
      'cookie',
      'session',
      'csrf',
      'api_key',
      'private_key',
      'access_token',
      'refresh_token'
    ],
    logLevel: (process.env.AUDIT_LOG_LEVEL as any) || 'info'
  },
  validation: {
    maxRequestSize: '50mb',
    maxUrlLength: 2048,
    maxHeaderSize: 8192,
    enableSqlInjectionProtection: true,
    enableXssProtection: true,
    enableCommandInjectionProtection: true
  }
};

// Security risk assessment
export interface SecurityRiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  recommendations: string[];
}

export const assessSecurityRisk = (req: Request): SecurityRiskAssessment => {
  const factors: string[] = [];
  const recommendations: string[] = [];
  let level: SecurityRiskAssessment['level'] = 'low';

  // Check for suspicious IP patterns
  const ip = req.ip || req.connection?.remoteAddress;
  if (ip) {
    // Check for private/local IPs in production
    if (process.env.NODE_ENV === 'production' && 
        (ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.'))) {
      factors.push('Private IP in production');
      level = 'medium';
    }
  }

  // Check User-Agent
  const userAgent = req.get('User-Agent');
  if (!userAgent) {
    factors.push('Missing User-Agent header');
    level = 'medium';
    recommendations.push('Investigate requests without User-Agent');
  } else if (userAgent.includes('bot') || userAgent.includes('crawler')) {
    factors.push('Bot/crawler detected');
    level = 'low';
  }

  // Check for suspicious headers
  const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-originating-ip'];
  suspiciousHeaders.forEach(header => {
    if (req.get(header)) {
      factors.push(`Proxy header detected: ${header}`);
      if (level === 'low') level = 'medium';
    }
  });

  // Check request size
  const contentLength = parseInt(req.get('content-length') || '0');
  if (contentLength > 10 * 1024 * 1024) { // 10MB
    factors.push('Large request body');
    level = 'medium';
    recommendations.push('Monitor for DoS attacks');
  }

  // Check for authentication bypass attempts
  const authHeader = req.get('authorization');
  if (authHeader && (authHeader.includes('null') || authHeader.includes('undefined'))) {
    factors.push('Suspicious authentication header');
    level = 'high';
    recommendations.push('Block potential authentication bypass');
  }

  // Check for SQL injection patterns in URL
  const url = req.url;
  const sqlPatterns = [/'/, /union/i, /select/i, /drop/i, /insert/i, /delete/i];
  if (sqlPatterns.some(pattern => pattern.test(url))) {
    factors.push('SQL injection patterns in URL');
    level = 'high';
    recommendations.push('Block request and investigate source');
  }

  // Check for XSS patterns
  const xssPatterns = [/<script/i, /javascript:/i, /onerror=/i, /onload=/i];
  const queryString = req.url.split('?')[1] || '';
  if (xssPatterns.some(pattern => pattern.test(queryString))) {
    factors.push('XSS patterns detected');
    level = 'high';
    recommendations.push('Sanitize input and block request');
  }

  return { level, factors, recommendations };
};

// Security middleware factory
export const createSecurityMiddleware = (config: Partial<SecurityConfig> = {}) => {
  const finalConfig = { ...defaultSecurityConfig, ...config };
  return finalConfig;
};

// Additional security patterns for enhanced protection
export const advancedSecurityPatterns = {
  // Advanced SQL injection patterns
  sqlInjectionPatterns: [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(--|\/\*|\*\/|;|'|"|`)/,
    /(\bOR\b|\bAND\b).*[=<>]/i,
    /\b(WAITFOR|DELAY)\b/i,
    /\b(CAST|CONVERT|CHAR|ASCII)\b.*\(/i,
    /\b(INFORMATION_SCHEMA|SYS\.)\b/i,
    /\b(LOAD_FILE|INTO\s+OUTFILE)\b/i
  ],

  // Advanced XSS patterns
  xssPatterns: [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^>]*>/gi,
    /<object\b[^>]*>/gi,
    /<embed\b[^>]*>/gi,
    /<link\b[^>]*>/gi,
    /<meta\b[^>]*>/gi,
    /expression\s*\(/gi,
    /vbscript:/gi,
    /data:text\/html/gi
  ],

  // Command injection patterns
  commandInjectionPatterns: [
    /[;&|`$(){}[\]]/g,
    /\b(rm|cat|ls|pwd|whoami|id|ps|kill|sudo|su|chmod|chown|curl|wget|nc|netcat)\b/gi,
    /\/etc\/passwd/gi,
    /\/bin\//gi,
    /\/usr\/bin\//gi,
    /\$\{.*\}/g, // Variable expansion
    /`.*`/g, // Command substitution
    /\$\(.*\)/g // Command substitution
  ],

  // Path traversal patterns
  pathTraversalPatterns: [
    /\.\./g,
    /%2e%2e/gi,
    /\.%2e/gi,
    /%2e\./gi,
    /\.\.\\/g,
    /\.\.\//g,
    /%5c/gi, // Backslash
    /%2f/gi  // Forward slash
  ],

  // LDAP injection patterns
  ldapInjectionPatterns: [
    /\*\)/g,
    /\|\|/g,
    /&&/g,
    /\(\|/g,
    /\(&/g
  ],

  // NoSQL injection patterns
  nosqlInjectionPatterns: [
    /\$where/gi,
    /\$ne/gi,
    /\$gt/gi,
    /\$lt/gi,
    /\$regex/gi,
    /\$or/gi,
    /\$and/gi
  ]
};

// Enhanced input validation
export const validateInput = (input: string, type: 'sql' | 'xss' | 'command' | 'path' | 'ldap' | 'nosql' = 'sql'): boolean => {
  let patterns: RegExp[] = [];
  
  switch (type) {
    case 'sql':
      patterns = advancedSecurityPatterns.sqlInjectionPatterns;
      break;
    case 'xss':
      patterns = advancedSecurityPatterns.xssPatterns;
      break;
    case 'command':
      patterns = advancedSecurityPatterns.commandInjectionPatterns;
      break;
    case 'path':
      patterns = advancedSecurityPatterns.pathTraversalPatterns;
      break;
    case 'ldap':
      patterns = advancedSecurityPatterns.ldapInjectionPatterns;
      break;
    case 'nosql':
      patterns = advancedSecurityPatterns.nosqlInjectionPatterns;
      break;
  }
  
  return !patterns.some(pattern => pattern.test(input));
};

// Security score calculator
export const calculateSecurityScore = (req: Request): number => {
  let score = 100; // Start with perfect score
  
  // Check for suspicious patterns in URL
  const url = req.url;
  if (advancedSecurityPatterns.sqlInjectionPatterns.some(p => p.test(url))) score -= 30;
  if (advancedSecurityPatterns.xssPatterns.some(p => p.test(url))) score -= 25;
  if (advancedSecurityPatterns.pathTraversalPatterns.some(p => p.test(url))) score -= 20;
  
  // Check User-Agent
  const userAgent = req.get('User-Agent') || '';
  if (!userAgent) score -= 15;
  if (userAgent.length < 10) score -= 10;
  if (/bot|crawler|spider/i.test(userAgent)) score -= 5;
  
  // Check for suspicious headers
  const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-originating-ip'];
  suspiciousHeaders.forEach(header => {
    if (req.get(header)) score -= 5;
  });
  
  // Check request size
  const contentLength = parseInt(req.get('content-length') || '0');
  if (contentLength > 10 * 1024 * 1024) score -= 20; // Large requests
  
  // Check for authentication bypass attempts
  const authHeader = req.get('authorization') || '';
  if (authHeader.includes('null') || authHeader.includes('undefined')) score -= 40;
  
  return Math.max(0, score);
};

// Validate security configuration
export const validateSecurityConfig = (config: SecurityConfig): string[] => {
  const errors: string[] = [];

  // Validate rate limiting
  if (config.rateLimiting.general.max <= 0) {
    errors.push('General rate limit max must be greater than 0');
  }

  if (config.rateLimiting.auth.max <= 0) {
    errors.push('Auth rate limit max must be greater than 0');
  }

  // Validate file upload
  if (config.fileUpload.maxFileSize <= 0) {
    errors.push('Max file size must be greater than 0');
  }

  if (config.fileUpload.allowedMimeTypes.length === 0) {
    errors.push('At least one MIME type must be allowed');
  }

  // Validate CORS
  if (config.cors.allowedOrigins.length === 0) {
    errors.push('At least one CORS origin must be specified');
  }

  // Validate encryption
  if (config.encryption.keyLength < 16) {
    errors.push('Encryption key length must be at least 16 bytes');
  }

  return errors;
};

export type { SecurityConfig };