#!/usr/bin/env tsx

/**
 * Security Configuration Validation Script
 * 
 * This script validates the security configuration and environment setup
 * to ensure all security measures are properly configured.
 */

import dotenv from 'dotenv';
import { validateSecurityConfig, defaultSecurityConfig } from '../src/lib/security-config.js';
import { generateEncryptionKey } from '../src/lib/encryption.js';

// Load environment variables
dotenv.config();

interface SecurityCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  recommendation?: string;
}

class SecurityValidator {
  private checks: SecurityCheck[] = [];

  addCheck(name: string, status: 'pass' | 'fail' | 'warning', message: string, recommendation?: string) {
    this.checks.push({ name, status, message, recommendation });
  }

  validateEnvironmentVariables() {
    console.log('🔍 Validating Environment Variables...\n');

    // Check encryption key
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      this.addCheck(
        'Encryption Key',
        'fail',
        'ENCRYPTION_KEY environment variable is not set',
        'Generate a secure encryption key using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    } else if (encryptionKey.length !== 64) {
      this.addCheck(
        'Encryption Key',
        'fail',
        `ENCRYPTION_KEY must be 64 characters (32 bytes in hex), got ${encryptionKey.length}`,
        'Generate a new 32-byte encryption key'
      );
    } else {
      this.addCheck('Encryption Key', 'pass', 'ENCRYPTION_KEY is properly configured');
    }

    // Check API keys
    const apiKeys = process.env.API_KEYS;
    if (!apiKeys) {
      this.addCheck(
        'API Keys',
        'warning',
        'API_KEYS environment variable is not set',
        'Set API_KEYS for external API access protection'
      );
    } else {
      const keyCount = apiKeys.split(',').length;
      this.addCheck('API Keys', 'pass', `${keyCount} API key(s) configured`);
    }

    // Check rate limiting configuration
    const rateLimitMax = process.env.RATE_LIMIT_MAX_REQUESTS;
    if (!rateLimitMax) {
      this.addCheck(
        'Rate Limiting',
        'warning',
        'Using default rate limiting configuration',
        'Consider setting RATE_LIMIT_MAX_REQUESTS for production'
      );
    } else {
      this.addCheck('Rate Limiting', 'pass', `Rate limit set to ${rateLimitMax} requests`);
    }

    // Check CORS configuration
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl && process.env.NODE_ENV === 'production') {
      this.addCheck(
        'CORS Configuration',
        'warning',
        'FRONTEND_URL not set in production',
        'Set FRONTEND_URL for proper CORS configuration'
      );
    } else {
      this.addCheck('CORS Configuration', 'pass', 'CORS configuration is set');
    }

    // Check security webhook
    const webhookUrl = process.env.SECURITY_EVENT_WEBHOOK_URL;
    if (!webhookUrl) {
      this.addCheck(
        'Security Webhooks',
        'warning',
        'SECURITY_EVENT_WEBHOOK_URL not configured',
        'Configure webhook URL for security event notifications'
      );
    } else {
      this.addCheck('Security Webhooks', 'pass', 'Security webhook configured');
    }

    // Check audit logging
    const auditEnabled = process.env.AUDIT_LOG_ENABLED;
    if (auditEnabled === 'false') {
      this.addCheck(
        'Audit Logging',
        'warning',
        'Audit logging is disabled',
        'Enable audit logging for security compliance'
      );
    } else {
      this.addCheck('Audit Logging', 'pass', 'Audit logging is enabled');
    }
  }

  validateSecurityConfiguration() {
    console.log('🔧 Validating Security Configuration...\n');

    const errors = validateSecurityConfig(defaultSecurityConfig);
    
    if (errors.length === 0) {
      this.addCheck('Security Config', 'pass', 'Security configuration is valid');
    } else {
      errors.forEach(error => {
        this.addCheck('Security Config', 'fail', error);
      });
    }

    // Check specific security settings
    if (defaultSecurityConfig.rateLimiting.general.max < 50) {
      this.addCheck(
        'Rate Limiting',
        'warning',
        'General rate limit is very restrictive',
        'Consider increasing for better user experience'
      );
    }

    if (defaultSecurityConfig.fileUpload.maxFileSize > 200 * 1024 * 1024) {
      this.addCheck(
        'File Upload Limits',
        'warning',
        'File upload limit is very high',
        'Consider reducing for better security'
      );
    }

    if (defaultSecurityConfig.cors.allowedOrigins.length === 0) {
      this.addCheck(
        'CORS Origins',
        'fail',
        'No CORS origins configured',
        'Configure allowed origins for CORS'
      );
    }
  }

  validateProductionReadiness() {
    console.log('🚀 Validating Production Readiness...\n');

    const nodeEnv = process.env.NODE_ENV;
    
    if (nodeEnv !== 'production') {
      this.addCheck(
        'Environment',
        'warning',
        `Running in ${nodeEnv || 'development'} mode`,
        'Set NODE_ENV=production for production deployment'
      );
    } else {
      this.addCheck('Environment', 'pass', 'Running in production mode');
    }

    // Check HTTPS enforcement
    if (nodeEnv === 'production') {
      this.addCheck('HTTPS Enforcement', 'pass', 'HTTPS enforcement enabled in production');
    } else {
      this.addCheck(
        'HTTPS Enforcement',
        'warning',
        'HTTPS enforcement disabled in development',
        'Ensure HTTPS is enforced in production'
      );
    }

    // Check security headers
    if (defaultSecurityConfig.headers.enableHSTS && nodeEnv === 'production') {
      this.addCheck('Security Headers', 'pass', 'HSTS enabled for production');
    } else if (nodeEnv === 'production') {
      this.addCheck(
        'Security Headers',
        'warning',
        'HSTS not enabled in production',
        'Enable HSTS for production security'
      );
    }

    // Check CSP
    if (defaultSecurityConfig.headers.enableCSP) {
      this.addCheck('Content Security Policy', 'pass', 'CSP is enabled');
    } else {
      this.addCheck(
        'Content Security Policy',
        'warning',
        'CSP is disabled',
        'Enable CSP for XSS protection'
      );
    }
  }

  async validateDependencies() {
    console.log('📦 Validating Security Dependencies...\n');

    try {
      // Check if required security packages are available
      await import('helmet');
      this.addCheck('Helmet', 'pass', 'Helmet security middleware is available');
    } catch {
      this.addCheck('Helmet', 'fail', 'Helmet package not found', 'Install helmet: npm install helmet');
    }

    try {
      await import('express-rate-limit');
      this.addCheck('Rate Limiting', 'pass', 'Express rate limit is available');
    } catch {
      this.addCheck('Rate Limiting', 'fail', 'Express rate limit not found', 'Install express-rate-limit');
    }

    try {
      await import('cors');
      this.addCheck('CORS', 'pass', 'CORS middleware is available');
    } catch {
      this.addCheck('CORS', 'fail', 'CORS package not found', 'Install cors: npm install cors');
    }

    try {
      await import('express-validator');
      this.addCheck('Input Validation', 'pass', 'Express validator is available');
    } catch {
      this.addCheck('Input Validation', 'fail', 'Express validator not found', 'Install express-validator');
    }
  }

  generateReport() {
    console.log('📊 Security Validation Report\n');
    console.log('=' .repeat(60));

    const passCount = this.checks.filter(c => c.status === 'pass').length;
    const warningCount = this.checks.filter(c => c.status === 'warning').length;
    const failCount = this.checks.filter(c => c.status === 'fail').length;

    console.log(`✅ Passed: ${passCount}`);
    console.log(`⚠️  Warnings: ${warningCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log('=' .repeat(60));

    // Group checks by status
    const failedChecks = this.checks.filter(c => c.status === 'fail');
    const warningChecks = this.checks.filter(c => c.status === 'warning');
    const passedChecks = this.checks.filter(c => c.status === 'pass');

    if (failedChecks.length > 0) {
      console.log('\n❌ FAILED CHECKS:');
      failedChecks.forEach(check => {
        console.log(`  • ${check.name}: ${check.message}`);
        if (check.recommendation) {
          console.log(`    💡 ${check.recommendation}`);
        }
      });
    }

    if (warningChecks.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      warningChecks.forEach(check => {
        console.log(`  • ${check.name}: ${check.message}`);
        if (check.recommendation) {
          console.log(`    💡 ${check.recommendation}`);
        }
      });
    }

    if (passedChecks.length > 0) {
      console.log('\n✅ PASSED CHECKS:');
      passedChecks.forEach(check => {
        console.log(`  • ${check.name}: ${check.message}`);
      });
    }

    // Overall security score
    const totalChecks = this.checks.length;
    const score = Math.round(((passCount + warningCount * 0.5) / totalChecks) * 100);
    
    console.log('\n' + '=' .repeat(60));
    console.log(`🔒 SECURITY SCORE: ${score}%`);
    
    if (score >= 90) {
      console.log('🎉 Excellent security configuration!');
    } else if (score >= 75) {
      console.log('👍 Good security configuration with minor improvements needed.');
    } else if (score >= 60) {
      console.log('⚠️  Adequate security but significant improvements recommended.');
    } else {
      console.log('🚨 Security configuration needs immediate attention!');
    }

    console.log('=' .repeat(60));

    // Exit with appropriate code
    if (failCount > 0) {
      console.log('\n❌ Security validation failed. Please address the failed checks before deployment.');
      process.exit(1);
    } else if (warningCount > 0) {
      console.log('\n⚠️  Security validation passed with warnings. Consider addressing warnings for better security.');
      process.exit(0);
    } else {
      console.log('\n✅ All security checks passed!');
      process.exit(0);
    }
  }

  generateEncryptionKeyIfNeeded() {
    if (!process.env.ENCRYPTION_KEY) {
      console.log('\n🔑 Generating new encryption key...');
      const newKey = generateEncryptionKey();
      console.log(`Add this to your .env file:`);
      console.log(`ENCRYPTION_KEY=${newKey}`);
      console.log('');
    }
  }

  async run() {
    console.log('🔒 DataTab Clone Security Configuration Validator\n');
    
    this.validateEnvironmentVariables();
    this.validateSecurityConfiguration();
    this.validateProductionReadiness();
    await this.validateDependencies();
    this.generateEncryptionKeyIfNeeded();
    this.generateReport();
  }
}

// Run the validator
const validator = new SecurityValidator();
validator.run().catch(console.error);