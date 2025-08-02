#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function setupDatabase() {
  try {
    console.log('🔄 Setting up database...');

    // Check if database is accessible
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection established');

    // Check if tables exist
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public';
    `;

    if (tables.length === 0) {
      console.log('📊 Running initial migration...');
      
      // Read and execute the migration SQL
      const migrationPath = join(__dirname, '../prisma/migrations/001_init.sql');
      const migrationSQL = readFileSync(migrationPath, 'utf-8');
      
      // Split by semicolon and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        try {
          await prisma.$executeRawUnsafe(statement);
        } catch (error) {
          console.error(`Error executing statement: ${statement.substring(0, 100)}...`);
          throw error;
        }
      }

      console.log('✅ Initial migration completed');
    } else {
      console.log('✅ Database tables already exist');
    }

    // Verify schema
    const userCount = await prisma.user.count();
    console.log(`📊 Database ready. Users: ${userCount}`);

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupDatabase();
}

export { setupDatabase };