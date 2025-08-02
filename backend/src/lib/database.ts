import { PrismaClient } from '@prisma/client';
import { QueryCacheService } from './redis.js';
import { withDatabaseMetrics } from './performance-monitor.js';

// Global variable to store the Prisma client instance
declare global {
  var __prisma: PrismaClient | undefined;
}

// Create a single instance of Prisma client with optimized configuration
const prisma = globalThis.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  errorFormat: 'pretty',
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  // Connection pool configuration
  __internal: {
    engine: {
      // Connection pool settings
      connection_limit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
      pool_timeout: parseInt(process.env.DB_POOL_TIMEOUT || '10'),
      schema_cache_size: parseInt(process.env.DB_SCHEMA_CACHE_SIZE || '1000'),
    }
  }
});

// In development, store the client in global to prevent multiple instances
if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export { prisma };

// Database connection health check
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Database initialization and migration check
export async function initializeDatabase(): Promise<void> {
  try {
    // Check if database is accessible
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to database');
    }

    console.log('✅ Database connection established');
    
    // In production, you might want to run migrations programmatically
    if (process.env.NODE_ENV === 'production') {
      // Note: In production, migrations should typically be run separately
      // This is just for demonstration
      console.log('📊 Database ready for production');
    }
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Transaction helper
export async function withTransaction<T>(
  callback: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(callback);
}

// Soft delete helper (for models that support it)
export async function softDelete(
  model: any,
  id: string,
  deletedByUserId?: string
): Promise<void> {
  await model.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      ...(deletedByUserId && { deletedBy: deletedByUserId })
    }
  });
}

// Bulk operations helper
export async function bulkUpsert<T>(
  model: any,
  data: T[],
  uniqueFields: string[]
): Promise<void> {
  for (const item of data) {
    const where = uniqueFields.reduce((acc, field) => {
      acc[field] = (item as any)[field];
      return acc;
    }, {} as any);

    await model.upsert({
      where,
      update: item,
      create: item
    });
  }
}

import { 
  User, 
  Project, 
  Dataset, 
  Analysis, 
  AnalysisType, 
  AnalysisStatus,
  CollaboratorRole 
} from '../types/database.js';
import { AnalysisParameters, AnalysisResults } from '../types/data-models.js';

/**
 * Database service with CRUD operations for all entities
 */
export class DatabaseService {
  
  /**
   * Execute a cached query
   */
  private static async executeCachedQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    cacheKey?: string,
    cacheTTL?: number
  ): Promise<T> {
    // Generate cache key if not provided
    if (!cacheKey) {
      cacheKey = QueryCacheService.generateQueryHash(queryName);
    }

    // Try to get from cache first
    const cachedResult = await QueryCacheService.getCachedQuery<T>(cacheKey);
    if (cachedResult !== null) {
      return cachedResult;
    }

    // Execute query with performance monitoring
    const result = await withDatabaseMetrics(queryName, queryFn);

    // Cache the result
    if (cacheTTL) {
      await QueryCacheService.cacheQuery(cacheKey, result, cacheTTL);
    }

    return result;
  }

  /**
   * Execute paginated query with optimization
   */
  private static async executePaginatedQuery<T>(
    queryName: string,
    queryFn: (skip: number, take: number) => Promise<T[]>,
    countFn: () => Promise<number>,
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: T[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const take = Math.min(limit, 100); // Max 100 items per page

    // Execute both queries in parallel
    const [data, total] = await Promise.all([
      withDatabaseMetrics(`${queryName}_data`, () => queryFn(skip, take)),
      withDatabaseMetrics(`${queryName}_count`, countFn)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      totalPages
    };
  }
  
  // User operations
  static async createUser(userData: Omit<User, 'id' | 'createdAt' | 'lastLoginAt'>): Promise<User> {
    return await prisma.user.create({
      data: {
        ...userData,
        lastLoginAt: null
      }
    }) as User;
  }

  static async getUserById(id: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { id }
    }) as User | null;
  }

  static async getUserByEmail(email: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { email }
    }) as User | null;
  }

  static async updateUserLastLogin(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() }
    });
  }

  // Project operations
  static async createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    return await prisma.project.create({
      data: projectData
    }) as Project;
  }

  static async getProject(id: string, userId: string): Promise<Project | null> {
    return await prisma.project.findFirst({
      where: {
        id,
        OR: [
          { ownerId: userId },
          { collaborators: { some: { userId } } }
        ]
      }
    }) as Project | null;
  }

  static async getUserProjects(userId: string, page: number = 1, limit: number = 20): Promise<{
    data: Project[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const cacheKey = `user_projects:${userId}:${page}:${limit}`;
    
    return await this.executeCachedQuery(
      'getUserProjects',
      async () => {
        return await this.executePaginatedQuery(
          'getUserProjects',
          (skip, take) => prisma.project.findMany({
            where: {
              OR: [
                { ownerId: userId },
                { collaborators: { some: { userId } } }
              ],
              isArchived: false
            },
            orderBy: { updatedAt: 'desc' },
            skip,
            take
          }) as Promise<Project[]>,
          () => prisma.project.count({
            where: {
              OR: [
                { ownerId: userId },
                { collaborators: { some: { userId } } }
              ],
              isArchived: false
            }
          }),
          page,
          limit
        );
      },
      cacheKey,
      300 // 5 minutes cache
    );
  }

  static async updateProject(id: string, userId: string, updates: Partial<Project>): Promise<Project | null> {
    // Check if user has permission to update
    const project = await this.getProject(id, userId);
    if (!project) return null;

    return await prisma.project.update({
      where: { id },
      data: {
        ...updates,
        updatedAt: new Date()
      }
    }) as Project;
  }

  // Dataset operations
  static async createDataset(datasetData: Omit<Dataset, 'id' | 'uploadedAt'>): Promise<Dataset> {
    return await prisma.dataset.create({
      data: datasetData
    }) as Dataset;
  }

  static async getDataset(id: string, userId: string): Promise<Dataset | null> {
    return await prisma.dataset.findFirst({
      where: {
        id,
        OR: [
          { userId },
          { project: { ownerId: userId } },
          { project: { collaborators: { some: { userId } } } }
        ]
      }
    }) as Dataset | null;
  }

  static async getUserDatasets(userId: string, page: number = 1, limit: number = 20): Promise<{
    data: Dataset[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const cacheKey = `user_datasets:${userId}:${page}:${limit}`;
    
    return await this.executeCachedQuery(
      'getUserDatasets',
      async () => {
        return await this.executePaginatedQuery(
          'getUserDatasets',
          (skip, take) => prisma.dataset.findMany({
            where: {
              OR: [
                { userId },
                { project: { ownerId: userId } },
                { project: { collaborators: { some: { userId } } } }
              ]
            },
            orderBy: { uploadedAt: 'desc' },
            skip,
            take
          }) as Promise<Dataset[]>,
          () => prisma.dataset.count({
            where: {
              OR: [
                { userId },
                { project: { ownerId: userId } },
                { project: { collaborators: { some: { userId } } } }
              ]
            }
          }),
          page,
          limit
        );
      },
      cacheKey,
      300 // 5 minutes cache
    );
  }

  static async getProjectDatasets(projectId: string, userId: string): Promise<Dataset[]> {
    // First verify user has access to the project
    const project = await this.getProject(projectId, userId);
    if (!project) return [];

    return await prisma.dataset.findMany({
      where: { projectId },
      orderBy: { uploadedAt: 'desc' }
    }) as Dataset[];
  }

  // Analysis operations
  static async createAnalysis(analysisData: {
    name: string;
    type: AnalysisType;
    datasetId: string;
    projectId: string;
    userId: string;
    parameters: AnalysisParameters;
    results?: AnalysisResults;
  }): Promise<Analysis> {
    return await prisma.analysis.create({
      data: {
        ...analysisData,
        status: AnalysisStatus.COMPLETED,
        results: analysisData.results || null
      }
    }) as Analysis;
  }

  static async getAnalysis(id: string, userId: string): Promise<Analysis | null> {
    return await prisma.analysis.findFirst({
      where: {
        id,
        project: {
          OR: [
            { ownerId: userId },
            { collaborators: { some: { userId } } }
          ]
        }
      }
    }) as Analysis | null;
  }

  static async getProjectAnalyses(projectId: string, userId: string): Promise<Analysis[]> {
    // First verify user has access to the project
    const project = await this.getProject(projectId, userId);
    if (!project) return [];

    return await prisma.analysis.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    }) as Analysis[];
  }

  static async updateAnalysisResults(id: string, results: AnalysisResults): Promise<Analysis | null> {
    return await prisma.analysis.update({
      where: { id },
      data: {
        results,
        status: AnalysisStatus.COMPLETED,
        updatedAt: new Date()
      }
    }) as Analysis;
  }

  // Column data operations (simplified - in real implementation this would be more complex)
  static async getColumnData(datasetId: string, columnName: string): Promise<any[] | null> {
    // This is a simplified implementation
    // In a real application, you would need to:
    // 1. Get the dataset file path
    // 2. Parse the file and extract the specific column
    // 3. Return the column data
    
    // For now, return mock data for testing
    // TODO: Implement actual file parsing and column extraction
    const dataset = await prisma.dataset.findUnique({
      where: { id: datasetId }
    });
    
    if (!dataset) return null;
    
    // Mock implementation - replace with actual file parsing
    if (columnName === 'age') {
      return [25, 30, 35, 40, 45, 50, 55, 60];
    } else if (columnName === 'score') {
      return [85, 90, 78, 92, 88, 76, 94, 82];
    } else if (columnName === 'category') {
      return ['A', 'B', 'A', 'C', 'B', 'A', 'C', 'B'];
    }
    
    return null;
  }

  // Collaboration operations
  static async addCollaborator(projectId: string, userId: string, role: CollaboratorRole, invitedBy: string): Promise<void> {
    // First verify the inviter has permission
    const project = await this.getProject(projectId, invitedBy);
    if (!project) throw new Error('Project not found or no permission');

    await prisma.projectCollaborator.create({
      data: {
        projectId,
        userId,
        role
      }
    });
  }

  static async removeCollaborator(projectId: string, userId: string, removedBy: string): Promise<void> {
    // First verify the remover has permission
    const project = await this.getProject(projectId, removedBy);
    if (!project) throw new Error('Project not found or no permission');

    await prisma.projectCollaborator.deleteMany({
      where: {
        projectId,
        userId
      }
    });
  }

  static async getProjectCollaborators(projectId: string, userId: string): Promise<any[]> {
    // First verify user has access to the project
    const project = await this.getProject(projectId, userId);
    if (!project) return [];

    return await prisma.projectCollaborator.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }
}