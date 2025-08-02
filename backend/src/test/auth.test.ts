import { describe, it, expect } from 'vitest';
import { 
  generateToken, 
  verifyToken, 
  hashPassword, 
  comparePassword,
  authenticateToken 
} from '../lib/auth.js';

describe('Authentication Service', () => {

  describe('JWT Token Functions', () => {
    it('should generate and verify JWT token', () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';
      
      const token = generateToken(userId, email);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      const decoded = verifyToken(token);
      expect(decoded.userId).toBe(userId);
      expect(decoded.email).toBe(email);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should throw error for invalid token', () => {
      expect(() => verifyToken('invalid-token')).toThrow();
    });
  });

  describe('Password Hashing', () => {
    it('should hash and compare passwords correctly', async () => {
      const password = 'TestPassword123';
      
      const hash = await hashPassword(password);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
      
      const isValid = await comparePassword(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await comparePassword('WrongPassword123', hash);
      expect(isInvalid).toBe(false);
    }, 10000); // 10 second timeout for bcrypt operations
  });



  describe('Authentication Middleware', () => {
    it('should authenticate valid token', () => {
      return new Promise<void>((resolve) => {
        const token = generateToken('test-user-id', 'test@example.com');
        const req = {
          headers: {
            authorization: `Bearer ${token}`
          }
        } as any;
        const res = {} as any;
        const next = () => {
          expect(req.user).toBeDefined();
          expect(req.user.userId).toBe('test-user-id');
          expect(req.user.email).toBe('test@example.com');
          resolve();
        };

        authenticateToken(req, res, next);
      });
    });

    it('should reject request without authorization header', () => {
      return new Promise<void>((resolve) => {
        const req = { headers: {} } as any;
        const res = {
          status: (code: number) => ({
            json: (data: any) => {
              expect(code).toBe(401);
              expect(data.error).toBe('Access token required');
              resolve();
            }
          })
        } as any;
        const next = () => {
          throw new Error('Should not call next');
        };

        authenticateToken(req, res, next);
      });
    });

    it('should reject invalid token', () => {
      return new Promise<void>((resolve) => {
        const req = {
          headers: {
            authorization: 'Bearer invalid-token'
          }
        } as any;
        const res = {
          status: (code: number) => ({
            json: (data: any) => {
              expect(code).toBe(401);
              expect(data.error).toBe('Invalid token');
              resolve();
            }
          })
        } as any;
        const next = () => {
          throw new Error('Should not call next');
        };

        authenticateToken(req, res, next);
      });
    });
  });
});