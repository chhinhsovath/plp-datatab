#!/usr/bin/env tsx

/**
 * Authentication System Demo
 * 
 * This script demonstrates the core authentication functionality
 * without requiring a database connection.
 */

import { 
  generateToken, 
  verifyToken, 
  hashPassword, 
  comparePassword 
} from '../lib/auth.js';
import { 
  registerSchema, 
  loginSchema, 
  updateProfileSchema, 
  changePasswordSchema 
} from '../lib/validation.js';

async function demonstrateAuth() {
  console.log('🔐 DataTab Authentication System Demo\n');

  // 1. Password Hashing Demo
  console.log('1. Password Hashing:');
  const password = 'MySecurePassword123';
  console.log(`   Original password: ${password}`);
  
  const hashedPassword = await hashPassword(password);
  console.log(`   Hashed password: ${hashedPassword.substring(0, 30)}...`);
  
  const isValidPassword = await comparePassword(password, hashedPassword);
  console.log(`   Password verification: ${isValidPassword ? '✅ Valid' : '❌ Invalid'}`);
  
  const isInvalidPassword = await comparePassword('WrongPassword123', hashedPassword);
  console.log(`   Wrong password verification: ${isInvalidPassword ? '✅ Valid' : '❌ Invalid'}\n`);

  // 2. JWT Token Demo
  console.log('2. JWT Token Generation and Verification:');
  const userId = 'user_123';
  const email = 'demo@example.com';
  
  const token = generateToken(userId, email);
  console.log(`   Generated token: ${token.substring(0, 50)}...`);
  
  try {
    const decoded = verifyToken(token);
    console.log(`   Decoded userId: ${decoded.userId}`);
    console.log(`   Decoded email: ${decoded.email}`);
    console.log(`   Token expiry: ${new Date(decoded.exp! * 1000).toISOString()}\n`);
  } catch (error) {
    console.log(`   Token verification failed: ${error}\n`);
  }

  // 3. Validation Schema Demo
  console.log('3. Input Validation:');
  
  // Valid registration data
  const validRegistration = {
    name: 'John Doe',
    email: '  JOHN@EXAMPLE.COM  ',
    password: 'SecurePassword123'
  };
  
  const regResult = registerSchema.safeParse(validRegistration);
  if (regResult.success) {
    console.log('   ✅ Valid registration data:');
    console.log(`      Name: ${regResult.data.name}`);
    console.log(`      Email: ${regResult.data.email} (normalized)`);
    console.log(`      Password: [HIDDEN]`);
  } else {
    console.log('   ❌ Registration validation failed');
  }

  // Invalid registration data
  const invalidRegistration = {
    name: 'J',
    email: 'invalid-email',
    password: 'weak'
  };
  
  const invalidRegResult = registerSchema.safeParse(invalidRegistration);
  if (!invalidRegResult.success) {
    console.log('   ❌ Invalid registration data (as expected):');
    invalidRegResult.error.issues.forEach(issue => {
      console.log(`      - ${issue.path.join('.')}: ${issue.message}`);
    });
  }

  // Valid login data
  console.log('\n   ✅ Valid login validation:');
  const loginResult = loginSchema.safeParse({
    email: 'john@example.com',
    password: 'SecurePassword123'
  });
  console.log(`      Login validation: ${loginResult.success ? 'Passed' : 'Failed'}`);

  // Profile update validation
  console.log('\n   ✅ Profile update validation:');
  const profileResult = updateProfileSchema.safeParse({
    name: 'Jane Doe'
  });
  console.log(`      Profile update validation: ${profileResult.success ? 'Passed' : 'Failed'}`);

  // Password change validation
  console.log('\n   ✅ Password change validation:');
  const passwordResult = changePasswordSchema.safeParse({
    currentPassword: 'OldPassword123',
    newPassword: 'NewSecurePassword123'
  });
  console.log(`      Password change validation: ${passwordResult.success ? 'Passed' : 'Failed'}`);

  console.log('\n🎉 Authentication system demo completed successfully!');
  console.log('\nKey Features Demonstrated:');
  console.log('• Secure password hashing with bcrypt (12 rounds)');
  console.log('• JWT token generation and verification');
  console.log('• Comprehensive input validation with Zod');
  console.log('• Email normalization (trim + lowercase)');
  console.log('• Strong password requirements');
  console.log('• Type-safe validation schemas');
}

// Run the demo
demonstrateAuth().catch(console.error);