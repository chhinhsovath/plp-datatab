import crypto from 'crypto';
import { errorLogger } from './error-logger.js';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits

// Get encryption key from environment or generate one
const getEncryptionKey = (): Buffer => {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    return Buffer.from(envKey, 'hex');
  }
  
  // Generate a new key if not provided (for development/testing)
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    const key = crypto.randomBytes(KEY_LENGTH);
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  No ENCRYPTION_KEY provided. Generated temporary key:', key.toString('hex'));
      console.warn('⚠️  Add ENCRYPTION_KEY to your .env file for production use');
    }
    return key;
  }
  
  throw new Error('ENCRYPTION_KEY environment variable is required in production');
};

let ENCRYPTION_KEY: Buffer;

// Lazy initialization to allow environment variables to be set in tests
const getKey = (): Buffer => {
  if (!ENCRYPTION_KEY) {
    ENCRYPTION_KEY = getEncryptionKey();
  }
  return ENCRYPTION_KEY;
};

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

/**
 * Encrypt sensitive data
 */
export const encrypt = (text: string): EncryptedData => {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    cipher.setAAD(Buffer.from('datatab-clone', 'utf8')); // Additional authenticated data
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  } catch (error) {
    errorLogger.logError(
      error as Error,
      undefined,
      { operation: 'encrypt' },
      ['security', 'encryption']
    );
    throw new Error('Encryption failed');
  }
};

/**
 * Decrypt sensitive data
 */
export const decrypt = (encryptedData: EncryptedData): string => {
  try {
    const { encrypted, iv, tag } = encryptedData;
    
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, 'hex'));
    decipher.setAAD(Buffer.from('datatab-clone', 'utf8'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    errorLogger.logError(
      error as Error,
      undefined,
      { operation: 'decrypt' },
      ['security', 'encryption']
    );
    throw new Error('Decryption failed');
  }
};

/**
 * Hash sensitive data (one-way)
 */
export const hash = (data: string, salt?: string): string => {
  try {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data, actualSalt, 10000, 64, 'sha512');
    return `${actualSalt}:${hash.toString('hex')}`;
  } catch (error) {
    errorLogger.logError(
      error as Error,
      undefined,
      { operation: 'hash' },
      ['security', 'hashing']
    );
    throw new Error('Hashing failed');
  }
};

/**
 * Verify hashed data
 */
export const verifyHash = (data: string, hashedData: string): boolean => {
  try {
    const [salt, originalHash] = hashedData.split(':');
    const hash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha512');
    return originalHash === hash.toString('hex');
  } catch (error) {
    errorLogger.logError(
      error as Error,
      undefined,
      { operation: 'verifyHash' },
      ['security', 'hashing']
    );
    return false;
  }
};

/**
 * Generate secure random token
 */
export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate API key
 */
export const generateApiKey = (): string => {
  const prefix = 'dtc_'; // DataTab Clone prefix
  const randomPart = crypto.randomBytes(24).toString('base64url');
  return `${prefix}${randomPart}`;
};

/**
 * Encrypt database fields that contain sensitive information
 */
export class FieldEncryption {
  /**
   * Encrypt a field value before storing in database
   */
  static encryptField(value: string | null): string | null {
    if (!value) return null;
    const encrypted = encrypt(value);
    return JSON.stringify(encrypted);
  }

  /**
   * Decrypt a field value after retrieving from database
   */
  static decryptField(encryptedValue: string | null): string | null {
    if (!encryptedValue) return null;
    try {
      const encryptedData = JSON.parse(encryptedValue) as EncryptedData;
      return decrypt(encryptedData);
    } catch (error) {
      errorLogger.logError(
        error as Error,
        undefined,
        { operation: 'decryptField' },
        ['security', 'field-encryption']
      );
      return null;
    }
  }

  /**
   * Check if a value is encrypted
   */
  static isEncrypted(value: string): boolean {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed.encrypted === 'string' && 
             typeof parsed.iv === 'string' && typeof parsed.tag === 'string';
    } catch {
      return false;
    }
  }
}

/**
 * Secure data masking for logging
 */
export const maskSensitiveData = (data: any): any => {
  if (typeof data === 'string') {
    // Mask email addresses
    if (data.includes('@')) {
      const [local, domain] = data.split('@');
      return `${local.substring(0, 2)}***@${domain}`;
    }
    // Mask long strings (potential tokens/keys)
    if (data.length > 20) {
      return `${data.substring(0, 4)}***${data.substring(data.length - 4)}`;
    }
    return data;
  }

  if (typeof data === 'object' && data !== null) {
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'phone'];
    const masked: any = Array.isArray(data) ? [] : {};
    
    for (const [key, value] of Object.entries(data)) {
      const isSensitive = sensitiveFields.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      );
      
      if (isSensitive && typeof value === 'string') {
        masked[key] = '***MASKED***';
      } else if (key.toLowerCase() === 'email' && typeof value === 'string') {
        // Special handling for email fields
        if (value.includes('@')) {
          const [local, domain] = value.split('@');
          masked[key] = `${local.substring(0, 2)}***@${domain}`;
        } else {
          masked[key] = '***MASKED***';
        }
      } else {
        masked[key] = maskSensitiveData(value);
      }
    }
    
    return masked;
  }

  return data;
};

/**
 * Generate encryption key for environment setup
 */
export const generateEncryptionKey = (): string => {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
};

// Export types are already exported above