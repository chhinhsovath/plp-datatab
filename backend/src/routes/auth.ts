import express from 'express';
import { PrismaClient } from '@prisma/client';
import { 
  generateToken, 
  hashPassword, 
  comparePassword, 
  authenticateToken,
  AuthenticatedRequest 
} from '../lib/auth.js';
import { 
  registerSchema, 
  loginSchema, 
  updateProfileSchema, 
  changePasswordSchema 
} from '../lib/validation.js';
import { 
  asyncHandler, 
  ValidationError, 
  ConflictError, 
  AuthenticationError, 
  NotFoundError 
} from '../middleware/error-handler.js';
import { withDatabaseRetry } from '../lib/retry.js';
import { auditLogger } from '../lib/audit-logger.js';
import { validateNoSQLInjection, handleValidationErrors } from '../middleware/security.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', 
  validateNoSQLInjection(['name', 'email']),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    try {
      // Validate input
      const validatedData = registerSchema.parse(req.body);
      const { name, email, password } = validatedData;

      // Check if user already exists
      const existingUser = await withDatabaseRetry(() =>
        prisma.user.findUnique({ where: { email } })
      );

      if (existingUser) {
        auditLogger.logAuthEvent('register', req, {
          success: false,
          userEmail: email,
          details: { reason: 'email_already_exists' }
        });
        throw new ConflictError('User with this email already exists');
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      const user = await withDatabaseRetry(() =>
        prisma.user.create({
          data: {
            name,
            email,
            passwordHash
          },
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true
          }
        })
      );

      // Generate JWT token
      const token = generateToken(user.id, user.email);

      // Log successful registration
      auditLogger.logAuthEvent('register', req, {
        success: true,
        userId: user.id,
        userEmail: user.email
      });

      res.status(201).json({
        message: 'User registered successfully',
        user,
        token
      });
    } catch (error) {
      // Log failed registration attempt
      auditLogger.logAuthEvent('register', req, {
        success: false,
        userEmail: req.body?.email,
        details: { error: (error as Error).message }
      });
      throw error;
    }
  })
);

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login',
  validateNoSQLInjection(['email']),
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    try {
      // Validate input
      const validatedData = loginSchema.parse(req.body);
      const { email, password } = validatedData;

      // Find user by email
      const user = await withDatabaseRetry(() =>
        prisma.user.findUnique({ where: { email } })
      );

      if (!user) {
        auditLogger.logAuthEvent('login', req, {
          success: false,
          userEmail: email,
          details: { reason: 'user_not_found' }
        });
        throw new AuthenticationError('Invalid email or password');
      }

      // Verify password
      const isValidPassword = await comparePassword(password, user.passwordHash);
      
      if (!isValidPassword) {
        auditLogger.logAuthEvent('login', req, {
          success: false,
          userId: user.id,
          userEmail: user.email,
          details: { reason: 'invalid_password' }
        });
        throw new AuthenticationError('Invalid email or password');
      }

      // Update last login time
      await withDatabaseRetry(() =>
        prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        })
      );

      // Generate JWT token
      const token = generateToken(user.id, user.email);

      // Log successful login
      auditLogger.logAuthEvent('login', req, {
        success: true,
        userId: user.id,
        userEmail: user.email
      });

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
          lastLoginAt: new Date()
        },
        token
      });
    } catch (error) {
      // Log failed login attempt
      auditLogger.logAuthEvent('login', req, {
        success: false,
        userEmail: req.body?.email,
        details: { error: (error as Error).message }
      });
      throw error;
    }
  })
);

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const user = await withDatabaseRetry(() =>
    prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        lastLoginAt: true
      }
    })
  );

  if (!user) {
    auditLogger.logDataAccessEvent('read', 'user_profile', req, {
      resourceId: req.user!.userId,
      sensitive: true,
      details: { reason: 'user_not_found' }
    });
    throw new NotFoundError('User not found');
  }

  auditLogger.logDataAccessEvent('read', 'user_profile', req, {
    resourceId: user.id,
    sensitive: true
  });

  res.json({ user });
}));

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  // Validate input
  const validatedData = updateProfileSchema.parse(req.body);
  const userId = req.user!.userId;

  // Check if email is being updated and if it's already taken
  if (validatedData.email) {
    const existingUser = await withDatabaseRetry(() =>
      prisma.user.findFirst({
        where: {
          email: validatedData.email,
          NOT: { id: userId }
        }
      })
    );

    if (existingUser) {
      throw new ConflictError('Email is already taken by another user');
    }
  }

  // Update user profile
  const updatedUser = await withDatabaseRetry(() =>
    prisma.user.update({
      where: { id: userId },
      data: validatedData,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        lastLoginAt: true
      }
    })
  );

  res.json({
    message: 'Profile updated successfully',
    user: updatedUser
  });
}));

/**
 * PUT /api/auth/password
 * Change user password
 */
router.put('/password', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  // Validate input
  const validatedData = changePasswordSchema.parse(req.body);
  const { currentPassword, newPassword } = validatedData;
  const userId = req.user!.userId;

  // Get current user
  const user = await withDatabaseRetry(() =>
    prisma.user.findUnique({ where: { id: userId } })
  );

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Verify current password
  const isValidPassword = await comparePassword(currentPassword, user.passwordHash);
  
  if (!isValidPassword) {
    throw new AuthenticationError('Current password is incorrect');
  }

  // Hash new password
  const newPasswordHash = await hashPassword(newPassword);

  // Update password
  await withDatabaseRetry(() =>
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    })
  );

  res.json({
    message: 'Password changed successfully'
  });
}));

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  // Log logout event
  auditLogger.logAuthEvent('logout', req, {
    success: true,
    userId: req.user!.userId,
    userEmail: req.user!.email
  });

  // With JWT, logout is primarily handled client-side by removing the token
  // This endpoint exists for consistency and potential future server-side logout logic
  res.json({
    message: 'Logout successful'
  });
}));

export default router;