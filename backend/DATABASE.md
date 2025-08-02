# Database Setup and Schema Documentation

## Overview

This document describes the database schema and setup for the DataTab Clone application. The application uses PostgreSQL as the primary database with Prisma as the ORM.

## Database Schema

### Core Entities

#### Users
- **Purpose**: Store user account information
- **Key Fields**: id, email, name, passwordHash, createdAt, lastLoginAt
- **Relationships**: One-to-many with Projects (as owner), Datasets, Comments, Activities

#### Projects
- **Purpose**: Organize datasets and analyses into collaborative workspaces
- **Key Fields**: id, name, description, ownerId, isArchived, createdAt, updatedAt
- **Relationships**: 
  - Belongs to User (owner)
  - Has many ProjectCollaborators, Datasets, Analyses, Reports, Visualizations

#### ProjectCollaborators
- **Purpose**: Manage user permissions within projects
- **Key Fields**: id, userId, projectId, role, joinedAt
- **Roles**: VIEWER, EDITOR, ADMIN
- **Relationships**: Links Users and Projects with role-based access

#### Datasets
- **Purpose**: Store uploaded data files and their metadata
- **Key Fields**: id, name, filePath, fileSize, metadata (JSON), userId, projectId
- **Metadata Structure**: Contains column information, data types, statistics
- **Relationships**: Belongs to User and Project, has many Analyses

#### Analyses
- **Purpose**: Store statistical analysis configurations and results
- **Key Fields**: id, name, type, parameters (JSON), results (JSON), status, datasetId, projectId
- **Types**: DESCRIPTIVE, TTEST, ANOVA, CORRELATION, REGRESSION, CHISQUARE, NONPARAMETRIC
- **Status**: PENDING, RUNNING, COMPLETED, FAILED
- **Relationships**: Belongs to Dataset and Project, has many Visualizations

#### Visualizations
- **Purpose**: Store chart configurations and visual representations
- **Key Fields**: id, name, type, config (JSON), analysisId, projectId
- **Types**: BAR, LINE, SCATTER, HISTOGRAM, BOXPLOT, HEATMAP, PIE
- **Relationships**: Optionally belongs to Analysis, belongs to Project

#### Reports
- **Purpose**: Store generated reports with formatted content
- **Key Fields**: id, title, content (JSON), template, version, projectId
- **Relationships**: Belongs to Project

#### Comments
- **Purpose**: Enable threaded discussions within projects
- **Key Fields**: id, content, userId, projectId, parentId (for threading)
- **Relationships**: Belongs to User and Project, self-referential for threading

#### Activities
- **Purpose**: Audit trail and activity logging
- **Key Fields**: id, type, details (JSON), userId, projectId, createdAt
- **Types**: PROJECT_CREATED, DATASET_UPLOADED, ANALYSIS_COMPLETED, etc.
- **Relationships**: Belongs to User and Project

## Setup Instructions

### Prerequisites
- PostgreSQL 12+ installed and running
- Node.js 18+ with npm/pnpm
- Environment variables configured

### Environment Configuration

Create a `.env` file in the backend directory:

```bash
# Database
DATABASE_URL="postgresql://datatab_user:datatab_password@localhost:5432/datatab_dev"

# Redis (for caching)
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your_jwt_secret_key_here"

# Server
PORT=3001
NODE_ENV=development
```

### Database Setup Commands

```bash
# Generate Prisma client
npm run db:generate

# Run database setup script (when database is available)
npm run db:setup

# Run migrations (alternative method)
npm run db:migrate

# Open Prisma Studio for database inspection
npm run db:studio

# Reset database (development only)
npm run db:reset
```

### Manual Database Setup

If you need to set up the database manually:

1. Create the PostgreSQL database:
```sql
CREATE DATABASE datatab_dev;
CREATE USER datatab_user WITH PASSWORD 'datatab_password';
GRANT ALL PRIVILEGES ON DATABASE datatab_dev TO datatab_user;
```

2. Run the migration SQL:
```bash
psql -U datatab_user -d datatab_dev -f prisma/migrations/001_init.sql
```

## Data Models and Types

### TypeScript Interfaces

The application includes comprehensive TypeScript interfaces for all database models:

- **Database Models** (`src/types/database.ts`): Core entity interfaces matching Prisma schema
- **Data Models** (`src/types/data-models.ts`): Complex JSON field structures and analysis types
- **Index** (`src/types/index.ts`): Consolidated exports and utility types

### Key Type Definitions

#### Dataset Metadata
```typescript
interface DatasetMetadata {
  columns: ColumnInfo[];
  rowCount: number;
  fileType: 'csv' | 'excel' | 'json';
  hasHeader: boolean;
  originalFileName: string;
  // ... additional fields
}
```

#### Analysis Parameters
```typescript
interface AnalysisParameters {
  variables: string[];
  options: Record<string, any>;
  filters?: DataFilter[];
  confidenceLevel?: number;
  alpha?: number;
}
```

#### Visualization Configuration
```typescript
interface VisualizationConfig {
  chartType: string;
  data: { x?: string; y?: string | string[]; color?: string; };
  styling: { title?: string; colors?: string[]; };
  interactivity: { tooltip?: boolean; zoom?: boolean; };
}
```

## Database Connection

### Connection Management

The database connection is managed through `src/lib/database.ts`:

- **Singleton Pattern**: Single Prisma client instance
- **Connection Pooling**: Automatic connection management
- **Graceful Shutdown**: Proper cleanup on application exit
- **Health Checks**: Connection validation utilities

### Transaction Support

```typescript
import { withTransaction } from './lib/database.js';

const result = await withTransaction(async (tx) => {
  const user = await tx.user.create({ data: userData });
  const project = await tx.project.create({ data: { ...projectData, ownerId: user.id } });
  return { user, project };
});
```

## Testing

### Test Structure

- **Database Tests** (`src/test/database.test.ts`): Full integration tests (requires running database)
- **Model Tests** (`src/test/models.test.ts`): Type validation and structure tests (no database required)

### Running Tests

```bash
# Run all tests
npm run test

# Run specific test file
npm run test -- models.test.ts

# Watch mode
npm run test:watch
```

## Performance Considerations

### Indexing Strategy

The schema includes strategic indexes for:
- Foreign key relationships
- Frequently queried fields (user_id, project_id)
- Time-based queries (created_at, updated_at)
- Status fields for filtering

### Query Optimization

- Use Prisma's `include` and `select` for efficient data fetching
- Implement pagination for large datasets
- Consider read replicas for analytics queries
- Use Redis caching for frequently accessed data

## Security Features

### Data Protection
- Cascading deletes for data consistency
- Foreign key constraints for referential integrity
- JSON validation through TypeScript interfaces
- Audit trail through Activities table

### Access Control
- Role-based permissions through ProjectCollaborators
- User ownership validation
- Project-level data isolation

## Migration Strategy

### Development
- Use `prisma migrate dev` for schema changes
- Automatic migration generation and application

### Production
- Use `prisma migrate deploy` for production deployments
- Manual migration review and approval process
- Database backup before migrations

## Monitoring and Maintenance

### Health Checks
- Database connection validation
- Query performance monitoring
- Storage usage tracking

### Backup Strategy
- Regular automated backups
- Point-in-time recovery capability
- Cross-region backup replication

## Troubleshooting

### Common Issues

1. **Connection Errors**: Verify DATABASE_URL and PostgreSQL service
2. **Migration Failures**: Check for schema conflicts and data constraints
3. **Performance Issues**: Review query patterns and add appropriate indexes
4. **Type Errors**: Ensure Prisma client is regenerated after schema changes

### Debug Commands

```bash
# Check database connection
npm run db:setup

# Inspect current schema
npm run db:studio

# View migration status
npx prisma migrate status

# Reset and reseed (development only)
npm run db:reset
```