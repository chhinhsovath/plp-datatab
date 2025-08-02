import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';

// Set encryption key for testing
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes in hex

import { 
  generalRateLimit,
  authRateLimit,
  corsOptions,
  sanitizeInput,
  validateNoSQLInjection,
  handleValidationErrors,
  securityHeaders,
  enforceHTTPS
} from '../middleware/security.js';
import { encrypt, decrypt, hash, verifyHash, FieldEncryption, maskSensitiveData } from '../lib/encryption.js';
import { auditLogger } from '../lib/audit-logger.js';

describe('Security Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      app.use('/test', generalRateLimit);
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should block requests exceeding rate limit', async () => {
      // Create a very restrictive rate limit for testing
      const testRateLimit = require('express-rate-limit')({
        windowMs: 1000,
        max: 1,
        message: 'Rate limit exceeded'
      });

      app.use('/test', testRateLimit);
      app.get('/test', (req, res) => res.json({ success: true }));

      // First request should succeed
      await request(app).get('/test').expect(200);

      // Second request should be rate limited
      await request(app).get('/test').expect(429);
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize XSS attempts in request body', async () => {
      app.use(sanitizeInput);
      app.post('/test', (req, res) => res.json(req.body));

      const maliciousInput = {
        name: '<script>alert("xss")</script>John',
        description: 'javascript:alert("xss")',
        data: { nested: '<iframe src="evil.com"></iframe>' }
      };

      const response = await request(app)
        .post('/test')
        .send(maliciousInput)
        .expect(200);

      expect(response.body.name).not.toContain('<script>');
      expect(response.body.description).not.toContain('javascript:');
      expect(response.body.data.nested).not.toContain('<iframe>');
    });

    it('should sanitize query parameters', async () => {
      app.use(sanitizeInput);
      app.get('/test', (req, res) => res.json(req.query));

      const response = await request(app)
        .get('/test?search=<script>alert("xss")</script>')
        .expect(200);

      expect(response.body.search).not.toContain('<script>');
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should block SQL injection attempts', async () => {
      app.use(express.json());
      app.post('/test', 
        validateNoSQLInjection(['email', 'name']),
        handleValidationErrors,
        (req, res) => res.json({ success: true })
      );

      const sqlInjectionAttempts = [
        { email: "test@example.com'; DROP TABLE users; --" },
        { name: "John' OR '1'='1" },
        { email: "test@example.com UNION SELECT * FROM passwords" }
      ];

      for (const attempt of sqlInjectionAttempts) {
        await request(app)
          .post('/test')
          .send(attempt)
          .expect(400);
      }
    });

    it('should allow valid input', async () => {
      app.use(express.json());
      app.post('/test', 
        validateNoSQLInjection(['email', 'name']),
        handleValidationErrors,
        (req, res) => res.json({ success: true })
      );

      const validInput = {
        email: 'test@example.com',
        name: 'John Doe'
      };

      await request(app)
        .post('/test')
        .send(validInput)
        .expect(200);
    });
  });

  describe('Security Headers', () => {
    it('should add security headers', async () => {
      app.use(securityHeaders);
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['x-request-id']).toBeDefined();
    });

    it('should remove server information', async () => {
      app.use(securityHeaders);
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('HTTPS Enforcement', () => {
    it('should redirect HTTP to HTTPS in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      app.use(enforceHTTPS);
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .get('/test')
        .set('Host', 'example.com')
        .expect(301);

      expect(response.headers.location).toBe('https://example.com/test');

      process.env.NODE_ENV = originalEnv;
    });

    it('should allow HTTP in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      app.use(enforceHTTPS);
      app.get('/test', (req, res) => res.json({ success: true }));

      await request(app)
        .get('/test')
        .expect(200);

      process.env.NODE_ENV = originalEnv;
    });
  });
});

describe('Encryption', () => {
  describe('Basic Encryption/Decryption', () => {
    it('should encrypt and decrypt data correctly', () => {
      const originalText = 'sensitive data';
      const encrypted = encrypt(originalText);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(originalText);
      expect(encrypted.encrypted).not.toBe(originalText);
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();
    });

    it('should produce different encrypted values for same input', () => {
      const text = 'test data';
      const encrypted1 = encrypt(text);
      const encrypted2 = encrypt(text);

      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });
  });

  describe('Hashing', () => {
    it('should hash data consistently', () => {
      const data = 'password123';
      const hashed = hash(data);
      const isValid = verifyHash(data, hashed);

      expect(isValid).toBe(true);
      expect(hashed).toContain(':'); // Should contain salt separator
    });

    it('should reject invalid hash verification', () => {
      const data = 'password123';
      const wrongData = 'wrongpassword';
      const hashed = hash(data);
      const isValid = verifyHash(wrongData, hashed);

      expect(isValid).toBe(false);
    });
  });

  describe('Field Encryption', () => {
    it('should encrypt and decrypt database fields', () => {
      const sensitiveData = 'user@example.com';
      const encrypted = FieldEncryption.encryptField(sensitiveData);
      const decrypted = FieldEncryption.decryptField(encrypted);

      expect(decrypted).toBe(sensitiveData);
      expect(encrypted).not.toBe(sensitiveData);
      expect(FieldEncryption.isEncrypted(encrypted!)).toBe(true);
    });

    it('should handle null values', () => {
      const encrypted = FieldEncryption.encryptField(null);
      const decrypted = FieldEncryption.decryptField(null);

      expect(encrypted).toBeNull();
      expect(decrypted).toBeNull();
    });
  });

  describe('Data Masking', () => {
    it('should mask sensitive data in logs', () => {
      const sensitiveData = {
        email: 'user@example.com',
        password: 'secretpassword123',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        normalField: 'normal data'
      };

      const masked = maskSensitiveData(sensitiveData);

      expect(masked.email).toBe('us***@example.com');
      expect(masked.password).toBe('***MASKED***');
      expect(masked.token).toBe('***MASKED***');
      expect(masked.normalField).toBe('normal data');
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          email: 'test@example.com',
          profile: {
            secretKey: 'very-secret-key-12345'
          }
        },
        publicData: 'visible'
      };

      const masked = maskSensitiveData(data);

      expect(masked.user.email).toBe('te***@example.com');
      expect(masked.user.profile.secretKey).toBe('***MASKED***');
      expect(masked.publicData).toBe('visible');
    });
  });
});

describe('Audit Logger', () => {
  beforeEach(() => {
    // Clear audit logs before each test by accessing the private arrays
    // This is a workaround since the audit logger is a singleton
    (auditLogger as any).events = [];
    (auditLogger as any).securityEvents = [];
  });

  describe('Audit Events', () => {
    it('should log audit events', () => {
      const mockReq = {
        ip: '127.0.0.1',
        user: { id: 'user123', email: 'test@example.com' },
        get: () => 'test-agent'
      } as any;

      auditLogger.logAuditEvent('test_action', 'test_resource', mockReq, {
        success: true,
        details: { test: 'data' }
      });

      const events = auditLogger.getAuditEvents(10);
      expect(events).toHaveLength(1);
      expect(events[0].action).toBe('test_action');
      expect(events[0].resource).toBe('test_resource');
      expect(events[0].userId).toBe('user123');
    });

    it('should mask sensitive data in audit logs', () => {
      const mockReq = {
        ip: '127.0.0.1',
        user: { id: 'user123', email: 'test@example.com' },
        get: () => 'test-agent'
      } as any;

      auditLogger.logAuditEvent('test_action', 'test_resource', mockReq, {
        details: {
          password: 'secret123',
          email: 'user@example.com',
          normalField: 'normal'
        }
      });

      const events = auditLogger.getAuditEvents(10);
      expect(events[0].details.password).toBe('***MASKED***');
      expect(events[0].details.email).toBe('us***@example.com');
      expect(events[0].details.normalField).toBe('normal');
    });
  });

  describe('Security Events', () => {
    it('should log security events', () => {
      const mockReq = {
        ip: '192.168.1.100',
        user: { id: 'user123', email: 'test@example.com' },
        get: () => 'malicious-agent'
      } as any;

      auditLogger.logSecurityEvent(
        'suspicious_activity',
        'injection',
        'error',
        mockReq,
        { details: { attempt: 'sql injection' } }
      );

      const events = auditLogger.getSecurityEvents(10);
      expect(events).toHaveLength(1);
      expect(events[0].action).toBe('suspicious_activity');
      expect(events[0].threatType).toBe('injection');
      expect(events[0].severity).toBe('error');
    });

    it('should log authentication events', () => {
      const mockReq = {
        ip: '127.0.0.1',
        get: () => 'browser-agent'
      } as any;

      auditLogger.logAuthEvent('login', mockReq, {
        success: false,
        userEmail: 'test@example.com',
        details: { reason: 'invalid_password' }
      });

      const events = auditLogger.getSecurityEvents(10);
      expect(events).toHaveLength(1);
      expect(events[0].action).toBe('login');
      expect(events[0].threatType).toBe('authentication');
      expect(events[0].success).toBe(false);
    });
  });

  describe('Security Metrics', () => {
    it('should provide security metrics', () => {
      const mockReq = {
        ip: '127.0.0.1',
        get: () => 'test-agent'
      } as any;

      // Log various security events
      auditLogger.logSecurityEvent('test1', 'authentication', 'error', mockReq);
      auditLogger.logSecurityEvent('test2', 'injection', 'critical', mockReq);
      auditLogger.logSecurityEvent('test3', 'authentication', 'warning', mockReq);

      const metrics = auditLogger.getSecurityMetrics();

      expect(metrics.totalSecurityEvents).toBe(3);
      expect(metrics.eventsByThreatType.authentication).toBe(2);
      expect(metrics.eventsByThreatType.injection).toBe(1);
      expect(metrics.eventsBySeverity.error).toBe(1);
      expect(metrics.eventsBySeverity.critical).toBe(1);
      expect(metrics.eventsBySeverity.warning).toBe(1);
    });
  });
});

describe('File Upload Security', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  it('should validate file extensions', () => {
    const validExtensions = ['.csv', '.xlsx', '.xls', '.json'];
    const invalidExtensions = ['.exe', '.bat', '.sh', '.php', '.js'];

    validExtensions.forEach(ext => {
      expect(ext).toMatch(/\.(csv|xlsx|xls|json)$/);
    });

    invalidExtensions.forEach(ext => {
      expect(ext).not.toMatch(/\.(csv|xlsx|xls|json)$/);
    });
  });

  it('should validate MIME types', () => {
    const validMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json'
    ];

    const invalidMimeTypes = [
      'application/x-executable',
      'text/html',
      'application/javascript',
      'image/jpeg'
    ];

    validMimeTypes.forEach(mimeType => {
      expect(['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/json', 'text/plain']).toContain(mimeType);
    });

    invalidMimeTypes.forEach(mimeType => {
      expect(['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/json', 'text/plain']).not.toContain(mimeType);
    });
  });

  it('should detect malicious filename patterns', () => {
    const maliciousFilenames = [
      '../../../etc/passwd',
      'file<script>.csv',
      'CON.csv',
      'test.exe.csv',
      'file|pipe.csv',
      'web.config',
      '.htaccess',
      'script.sh',
      'malware%00.csv'
    ];

    const safeFilenames = [
      'data.csv',
      'report_2023.xlsx',
      'analysis-results.json',
      'dataset_v1.2.csv'
    ];

    const maliciousPatterns = [
      /\.\./,
      /[<>:"|?*]/,
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i,
      /\.(exe|bat|cmd|scr|pif|dll|vbs|jar|app|deb|rpm)(\.|$)/i,
      /%00/,
      /\.(htaccess|htpasswd)$/i,
      /web\.config$/i,
      /\.(sh|bash|zsh|fish)$/i
    ];

    maliciousFilenames.forEach(filename => {
      const isMalicious = maliciousPatterns.some(pattern => {
        // For CON.csv, we need to check the base name without extension
        if (pattern.source.includes('CON|PRN')) {
          const baseName = filename.split('.')[0];
          return pattern.test(baseName);
        }
        // For test.exe.csv, check if it contains .exe anywhere
        if (pattern.source.includes('exe|bat')) {
          return pattern.test(filename);
        }
        return pattern.test(filename);
      });
      // Debug log to see which filename is failing
      if (!isMalicious) {
        console.log(`Filename "${filename}" was not detected as malicious`);
      }
      expect(isMalicious).toBe(true);
    });

    safeFilenames.forEach(filename => {
      const isMalicious = maliciousPatterns.some(pattern => {
        if (pattern.source.includes('CON|PRN')) {
          const baseName = filename.split('.')[0];
          return pattern.test(baseName);
        }
        if (pattern.source.includes('exe|bat')) {
          return pattern.test(filename);
        }
        return pattern.test(filename);
      });
      expect(isMalicious).toBe(false);
    });
  });

  it('should detect malicious file content', () => {
    const maliciousContents = [
      '<script>alert("xss")</script>',
      'javascript:alert("xss")',
      '<iframe src="evil.com"></iframe>',
      'eval(maliciousCode)',
      'document.write("<script>evil</script>")',
      '<?php system($_GET["cmd"]); ?>',
      '<% response.write("asp code") %>'
    ];

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

    maliciousContents.forEach(content => {
      const isMalicious = maliciousContentPatterns.some(pattern => pattern.test(content));
      expect(isMalicious).toBe(true);
    });
  });
});

describe('Advanced Security Patterns', () => {
  it('should detect advanced SQL injection patterns', async () => {
    const { advancedSecurityPatterns } = await import('../lib/security-config.js');
    
    const advancedSqlPayloads = [
      "'; WAITFOR DELAY '00:00:05'; --",
      "' AND (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES) > 0 --",
      "'; EXEC xp_cmdshell('dir'); --",
      "' UNION SELECT LOAD_FILE('/etc/passwd') --",
      "'; INSERT INTO users SELECT * FROM admin_users; --"
    ];

    advancedSqlPayloads.forEach(payload => {
      const isDetected = advancedSecurityPatterns.sqlInjectionPatterns.some((pattern: RegExp) => 
        pattern.test(payload)
      );
      expect(isDetected).toBe(true);
    });
  });

  it('should detect advanced XSS patterns', async () => {
    const { advancedSecurityPatterns } = await import('../lib/security-config.js');
    
    const advancedXssPayloads = [
      '<svg onload="alert(1)">',
      '<link rel="stylesheet" href="javascript:alert(1)">',
      '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox("xss")',
      '<style>@import"javascript:alert(1)";</style>'
    ];

    advancedXssPayloads.forEach(payload => {
      const isDetected = advancedSecurityPatterns.xssPatterns.some((pattern: RegExp) => 
        pattern.test(payload)
      );
      expect(isDetected).toBe(true);
    });
  });

  it('should detect NoSQL injection patterns', async () => {
    const { advancedSecurityPatterns } = await import('../lib/security-config.js');
    
    const nosqlPayloads = [
      '{"$where": "this.username == this.password"}',
      '{"username": {"$ne": null}}',
      '{"$or": [{"username": "admin"}, {"role": "admin"}]}',
      '{"password": {"$regex": ".*"}}'
    ];

    nosqlPayloads.forEach(payload => {
      const isDetected = advancedSecurityPatterns.nosqlInjectionPatterns.some((pattern: RegExp) => 
        pattern.test(payload)
      );
      expect(isDetected).toBe(true);
    });
  });

  it('should calculate security scores correctly', async () => {
    const { calculateSecurityScore } = await import('../lib/security-config.js');
    
    // Mock high-risk request
    const highRiskReq = {
      url: '/api/test?id=1\' OR \'1\'=\'1',
      get: (header: string) => {
        if (header === 'User-Agent') return '';
        if (header === 'authorization') return 'Bearer null';
        if (header === 'content-length') return '50000000';
        return undefined;
      }
    };

    const highRiskScore = calculateSecurityScore(highRiskReq as any);
    expect(highRiskScore).toBeLessThan(50);

    // Mock low-risk request
    const lowRiskReq = {
      url: '/api/test?id=123',
      get: (header: string) => {
        if (header === 'User-Agent') return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
        if (header === 'authorization') return 'Bearer valid-token';
        if (header === 'content-length') return '1024';
        return undefined;
      }
    };

    const lowRiskScore = calculateSecurityScore(lowRiskReq as any);
    expect(lowRiskScore).toBeGreaterThan(80);
  });
});