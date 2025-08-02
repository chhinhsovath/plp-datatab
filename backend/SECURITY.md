# Security Implementation Guide

This document outlines the comprehensive security measures implemented in the DataTab Clone backend application.

## Overview

The application implements multiple layers of security controls to protect against common web application vulnerabilities and attacks. All security measures follow industry best practices and OWASP guidelines.

## Security Architecture

### 1. Rate Limiting

**Implementation**: Express Rate Limit middleware with Redis backing
**Protection Against**: DoS attacks, brute force attacks, API abuse

- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 5 requests per 15 minutes per IP
- **File Upload**: 10 uploads per hour per IP
- **Analysis**: 20 requests per 5 minutes per IP

**Configuration**:
```typescript
// Environment variables
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5
UPLOAD_RATE_LIMIT_MAX=10
ANALYSIS_RATE_LIMIT_MAX=20
```

### 2. CORS (Cross-Origin Resource Sharing)

**Implementation**: Enhanced CORS configuration with origin validation
**Protection Against**: Cross-origin attacks, unauthorized API access

**Allowed Origins**:
- `http://localhost:3000` (Development)
- `http://localhost:5173` (Vite dev server)
- `https://datatab-clone.vercel.app` (Production)
- Environment-specific origins via `FRONTEND_URL`

**Configuration**:
```typescript
corsOptions: {
  origin: (origin, callback) => { /* Dynamic origin validation */ },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining', 'X-Request-ID'],
  maxAge: 86400 // 24 hours
}
```

### 3. Input Sanitization

**Implementation**: Multi-layer input sanitization middleware
**Protection Against**: XSS, SQL injection, command injection

**Sanitization Rules**:
- Remove `<script>` tags and JavaScript protocols
- Strip event handlers (`onclick`, `onload`, etc.)
- Remove SQL injection patterns (`DROP TABLE`, `UNION SELECT`, etc.)
- Filter command injection patterns (`rm`, `cat`, `|`, `;`, etc.)
- Clean directory traversal attempts (`../`)

### 4. SQL Injection Prevention

**Implementation**: Parameterized queries with Prisma ORM + input validation
**Protection Against**: SQL injection attacks

**Validation Rules**:
- Block SQL keywords in user input
- Remove SQL comment patterns (`--`, `/* */`)
- Filter boolean logic patterns (`OR 1=1`, `AND 1=1`)
- Validate input against expected patterns

### 5. File Upload Security

**Implementation**: Multi-layer file validation and security checks
**Protection Against**: Malicious file uploads, code execution

**Security Measures**:
- **File Type Validation**: Only allow CSV, Excel, JSON files
- **MIME Type Checking**: Validate actual file content type
- **Filename Sanitization**: Block malicious filename patterns
- **File Size Limits**: 100MB maximum file size
- **Content Scanning**: Basic malicious content detection
- **Virus Scanning**: Placeholder for future AV integration

**Blocked Patterns**:
```typescript
const maliciousPatterns = [
  /\.\./,                    // Directory traversal
  /[<>:"|?*]/,              // Invalid filename characters
  /^(CON|PRN|AUX|NUL)$/i,   // Windows reserved names
  /\.(exe|bat|cmd|scr)$/i,  // Executable extensions
  /<script/i,               // Script tags in content
  /javascript:/i            // JavaScript protocols
];
```

### 6. Data Encryption

**Implementation**: AES-256-GCM encryption for sensitive data
**Protection Against**: Data breaches, unauthorized data access

**Features**:
- **Algorithm**: AES-256-GCM with authenticated encryption
- **Key Management**: Environment-based key storage
- **Field Encryption**: Automatic encryption for sensitive database fields
- **Data Masking**: Sensitive data masking in logs and audit trails

**Usage**:
```typescript
// Encrypt sensitive data
const encrypted = encrypt(sensitiveData);

// Decrypt when needed
const decrypted = decrypt(encrypted);

// Field-level encryption for database
const encryptedField = FieldEncryption.encryptField(value);
```

### 7. Security Headers

**Implementation**: Comprehensive security headers via Helmet.js
**Protection Against**: XSS, clickjacking, MIME sniffing

**Headers Applied**:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Content-Security-Policy`: Restrictive CSP policy
- `Referrer-Policy: strict-origin-when-cross-origin`

### 8. HTTPS Enforcement

**Implementation**: Automatic HTTPS redirect in production
**Protection Against**: Man-in-the-middle attacks, data interception

**Configuration**:
```typescript
// Automatic redirect in production
if (process.env.NODE_ENV === 'production' && !req.secure) {
  return res.redirect(301, `https://${req.get('Host')}${req.url}`);
}
```

### 9. Audit Logging

**Implementation**: Comprehensive security event logging
**Protection Against**: Security incidents, compliance violations

**Logged Events**:
- Authentication attempts (success/failure)
- Authorization failures
- File upload activities
- Data access events
- Security violations
- Rate limit violations
- Suspicious activities

**Log Structure**:
```typescript
interface AuditEvent {
  id: string;
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  details: any;
}
```

### 10. Security Monitoring

**Implementation**: Real-time security threat detection and response
**Protection Against**: Advanced persistent threats, coordinated attacks

**Features**:
- **Risk Assessment**: Automatic risk scoring for requests
- **IP Blocking**: Automatic blocking of malicious IPs
- **Alert System**: Real-time security alerts
- **Metrics Dashboard**: Security metrics and analytics
- **Webhook Integration**: External security system integration

**Risk Factors**:
- Suspicious IP patterns
- Missing or malicious User-Agent headers
- Large request payloads
- Authentication bypass attempts
- SQL injection patterns in URLs
- XSS patterns in parameters

### 11. API Key Management

**Implementation**: Secure API key validation for external integrations
**Protection Against**: Unauthorized API access

**Features**:
- Environment-based key storage
- Multiple key support
- Request validation middleware
- Usage tracking and monitoring

## Security Configuration

### Environment Variables

```bash
# Encryption
ENCRYPTION_KEY="your_32_byte_hex_encryption_key_here"

# API Security
API_KEYS="api_key_1,api_key_2,api_key_3"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5
UPLOAD_RATE_LIMIT_MAX=10
ANALYSIS_RATE_LIMIT_MAX=20

# CORS
FRONTEND_URL="https://your-frontend-domain.com"

# Security Headers
ENABLE_HTTPS_REDIRECT=true
SECURITY_HEADERS_ENABLED=true
CSP_ENABLED=true

# Audit Logging
AUDIT_LOG_ENABLED=true
AUDIT_LOG_LEVEL=info
SECURITY_EVENT_WEBHOOK_URL="https://your-security-webhook.com"
```

### Security Validation

The application includes a comprehensive security validation script that checks:

- Environment variable configuration
- Security middleware setup
- Production readiness
- Dependency availability
- Encryption key validity

**Run Security Validation:**
```bash
# Validate security configuration
npm run security:validate

# Run security tests and validation
npm run security:check
```

**Security Score Calculation:**
The validator provides a security score based on:
- ✅ Passed checks (100% weight)
- ⚠️ Warning checks (50% weight)
- ❌ Failed checks (0% weight)

Scores:
- 90-100%: Excellent security configuration
- 75-89%: Good security with minor improvements needed
- 60-74%: Adequate security with significant improvements recommended
- <60%: Immediate security attention required

### Security Middleware Stack

The security middleware is applied in the following order:

1. **HTTPS Enforcement** - Force HTTPS in production
2. **Security Headers** - Apply security headers
3. **Helmet Configuration** - Enhanced security headers
4. **CORS** - Cross-origin request validation
5. **Security Monitoring** - Threat detection and IP blocking
6. **Rate Limiting** - Request rate limiting
7. **Input Sanitization** - Clean malicious input

## Testing

### Security Test Suite

The application includes comprehensive security tests:

- **Unit Tests**: `src/test/security.test.ts`
- **Penetration Tests**: `src/test/penetration.test.ts`

**Test Coverage**:
- Rate limiting effectiveness
- Input sanitization
- SQL injection prevention
- XSS protection
- File upload security
- Authentication bypass attempts
- CORS policy enforcement
- Header injection prevention
- DoS attack resilience
- Information disclosure prevention

### Running Security Tests

```bash
# Run security unit tests
npm test -- --run src/test/security.test.ts

# Run penetration tests
npm test -- --run src/test/penetration.test.ts

# Run all tests
npm test
```

## Security Monitoring

### Production Security Endpoints

**API Key Required:** All security monitoring endpoints require a valid API key in the `X-API-Key` header.

```bash
# Security metrics for monitoring systems
GET /api/security/metrics
Headers: X-API-Key: your-api-key

# Security alerts and events
GET /api/security/alerts?level=high&limit=50
Headers: X-API-Key: your-api-key

# Blocked and suspicious IPs
GET /api/security/blocked-ips
Headers: X-API-Key: your-api-key

# Security configuration status
GET /api/security/config-status
Headers: X-API-Key: your-api-key

# Security health check
GET /api/security/health
Headers: X-API-Key: your-api-key

# Emergency IP unblock (admin only)
POST /api/security/unblock-ip
Headers: X-API-Key: your-api-key
Body: { "ip": "192.168.1.100", "reason": "False positive" }
```

### Debug Endpoints (Development Only)

```bash
# Security metrics and events
GET /api/debug/security

# Audit logs
GET /api/debug/audit

# Blocked IPs
GET /api/debug/security/blocked-ips

# Unblock IP
POST /api/debug/security/unblock-ip
```

### Advanced Security Features

**Enhanced Input Validation:**
- Advanced SQL injection pattern detection
- NoSQL injection prevention
- LDAP injection blocking
- Path traversal protection
- Command injection prevention
- XSS pattern recognition

**File Upload Security:**
- Content-based malicious pattern detection
- Enhanced filename validation
- MIME type verification
- File size limits
- Virus scanning placeholder (ready for integration)

**Security Scoring:**
- Real-time request risk assessment
- Automated threat level calculation
- Behavioral analysis patterns
- IP reputation tracking

### Security Metrics

The application provides real-time security metrics:

- Total security events
- Events by threat type
- Events by severity level
- Top attack sources
- Blocked requests count
- Suspicious activities

## Incident Response

### Automatic Responses

1. **Rate Limit Exceeded**: Temporary IP blocking
2. **SQL Injection Detected**: Request blocking + logging
3. **Malicious File Upload**: File rejection + user notification
4. **Suspicious Activity**: Enhanced monitoring + alerting

### Manual Responses

1. **Review Security Logs**: Check `/api/debug/security`
2. **Block Malicious IPs**: Use unblock endpoint if needed
3. **Update Security Rules**: Modify patterns in security config
4. **Escalate to Security Team**: Use webhook notifications

## Compliance

### Standards Compliance

- **OWASP Top 10**: Protection against all major web vulnerabilities
- **GDPR**: Data encryption and audit logging for EU compliance
- **SOC 2**: Security monitoring and access controls
- **WCAG 2.1 AA**: Accessibility compliance in security features

### Security Certifications

- Input validation against OWASP guidelines
- Encryption using NIST-approved algorithms
- Logging compliant with security frameworks

## Best Practices

### Development

1. **Never log sensitive data** - Use data masking
2. **Validate all inputs** - Client and server-side validation
3. **Use parameterized queries** - Prevent SQL injection
4. **Implement proper error handling** - Don't expose stack traces
5. **Regular security updates** - Keep dependencies updated

### Deployment

1. **Use HTTPS everywhere** - No exceptions in production
2. **Set strong CSP policies** - Prevent XSS attacks
3. **Monitor security metrics** - Set up alerting
4. **Regular security audits** - Automated and manual testing
5. **Backup encryption keys** - Secure key management

### Operations

1. **Monitor audit logs** - Regular log review
2. **Update security rules** - Adapt to new threats
3. **Incident response plan** - Documented procedures
4. **Security training** - Keep team updated
5. **Vulnerability management** - Regular security assessments

## Security Updates

This security implementation is regularly updated to address new threats and vulnerabilities. Check the git history for recent security improvements and always use the latest version in production.

For security issues or questions, please contact the security team or create a security-related issue in the project repository.