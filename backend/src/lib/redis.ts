import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// Redis client instance
let redisClient: RedisClientType | null = null;

// Redis configuration
const REDIS_CONFIG = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 5000,
    lazyConnect: true,
  },
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
};

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  SESSION: 24 * 60 * 60, // 24 hours
  ANALYSIS_RESULT: 60 * 60, // 1 hour
  DATASET_METADATA: 30 * 60, // 30 minutes
  USER_DATA: 15 * 60, // 15 minutes
  STATISTICAL_COMPUTATION: 2 * 60 * 60, // 2 hours
  QUERY_RESULT: 10 * 60, // 10 minutes
} as const;

// Cache key prefixes
export const CACHE_KEYS = {
  SESSION: 'session:',
  ANALYSIS: 'analysis:',
  DATASET: 'dataset:',
  USER: 'user:',
  QUERY: 'query:',
  STATS: 'stats:',
  COLLABORATION: 'collab:',
} as const;

/**
 * Initialize Redis connection
 */
export async function initializeRedis(): Promise<void> {
  try {
    if (redisClient) {
      return; // Already initialized
    }

    redisClient = createClient(REDIS_CONFIG);

    // Error handling
    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redisClient.on('ready', () => {
      console.log('🔄 Redis client ready');
    });

    redisClient.on('end', () => {
      console.log('🔌 Redis connection ended');
    });

    // Connect to Redis
    await redisClient.connect();
    
    // Test connection
    await redisClient.ping();
    console.log('🏓 Redis ping successful');

  } catch (error) {
    console.error('❌ Failed to initialize Redis:', error);
    // Don't throw error to allow app to continue without Redis
    redisClient = null;
  }
}

/**
 * Get Redis client instance
 */
export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redisClient !== null && redisClient.isReady;
}

/**
 * Generic cache operations
 */
export class CacheService {
  
  /**
   * Set a value in cache with TTL
   */
  static async set(key: string, value: any, ttl: number = CACHE_TTL.QUERY_RESULT): Promise<boolean> {
    try {
      if (!isRedisAvailable()) return false;
      
      const serializedValue = JSON.stringify(value);
      await redisClient!.setEx(key, ttl, serializedValue);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Get a value from cache
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      if (!isRedisAvailable()) return null;
      
      const value = await redisClient!.get(key);
      if (!value) return null;
      
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Delete a key from cache
   */
  static async delete(key: string): Promise<boolean> {
    try {
      if (!isRedisAvailable()) return false;
      
      const result = await redisClient!.del(key);
      return result > 0;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  static async deletePattern(pattern: string): Promise<number> {
    try {
      if (!isRedisAvailable()) return 0;
      
      const keys = await redisClient!.keys(pattern);
      if (keys.length === 0) return 0;
      
      const result = await redisClient!.del(keys);
      return result;
    } catch (error) {
      console.error('Cache delete pattern error:', error);
      return 0;
    }
  }

  /**
   * Check if a key exists in cache
   */
  static async exists(key: string): Promise<boolean> {
    try {
      if (!isRedisAvailable()) return false;
      
      const result = await redisClient!.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Set TTL for an existing key
   */
  static async expire(key: string, ttl: number): Promise<boolean> {
    try {
      if (!isRedisAvailable()) return false;
      
      const result = await redisClient!.expire(key, ttl);
      return result;
    } catch (error) {
      console.error('Cache expire error:', error);
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  static async getTTL(key: string): Promise<number> {
    try {
      if (!isRedisAvailable()) return -1;
      
      return await redisClient!.ttl(key);
    } catch (error) {
      console.error('Cache TTL error:', error);
      return -1;
    }
  }

  /**
   * Increment a numeric value
   */
  static async increment(key: string, amount: number = 1): Promise<number> {
    try {
      if (!isRedisAvailable()) return 0;
      
      return await redisClient!.incrBy(key, amount);
    } catch (error) {
      console.error('Cache increment error:', error);
      return 0;
    }
  }

  /**
   * Set multiple key-value pairs
   */
  static async setMultiple(keyValuePairs: Record<string, any>, ttl?: number): Promise<boolean> {
    try {
      if (!isRedisAvailable()) return false;
      
      const pipeline = redisClient!.multi();
      
      for (const [key, value] of Object.entries(keyValuePairs)) {
        const serializedValue = JSON.stringify(value);
        if (ttl) {
          pipeline.setEx(key, ttl, serializedValue);
        } else {
          pipeline.set(key, serializedValue);
        }
      }
      
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('Cache set multiple error:', error);
      return false;
    }
  }

  /**
   * Get multiple values by keys
   */
  static async getMultiple<T>(keys: string[]): Promise<Record<string, T | null>> {
    try {
      if (!isRedisAvailable() || keys.length === 0) {
        return keys.reduce((acc, key) => ({ ...acc, [key]: null }), {});
      }
      
      const values = await redisClient!.mGet(keys);
      const result: Record<string, T | null> = {};
      
      keys.forEach((key, index) => {
        const value = values[index];
        result[key] = value ? JSON.parse(value) as T : null;
      });
      
      return result;
    } catch (error) {
      console.error('Cache get multiple error:', error);
      return keys.reduce((acc, key) => ({ ...acc, [key]: null }), {});
    }
  }
}

/**
 * Session management using Redis
 */
export class SessionService {
  
  /**
   * Store session data
   */
  static async setSession(sessionId: string, sessionData: any): Promise<boolean> {
    const key = `${CACHE_KEYS.SESSION}${sessionId}`;
    return await CacheService.set(key, sessionData, CACHE_TTL.SESSION);
  }

  /**
   * Get session data
   */
  static async getSession<T>(sessionId: string): Promise<T | null> {
    const key = `${CACHE_KEYS.SESSION}${sessionId}`;
    return await CacheService.get<T>(key);
  }

  /**
   * Delete session
   */
  static async deleteSession(sessionId: string): Promise<boolean> {
    const key = `${CACHE_KEYS.SESSION}${sessionId}`;
    return await CacheService.delete(key);
  }

  /**
   * Extend session TTL
   */
  static async extendSession(sessionId: string): Promise<boolean> {
    const key = `${CACHE_KEYS.SESSION}${sessionId}`;
    return await CacheService.expire(key, CACHE_TTL.SESSION);
  }
}

/**
 * Analysis result caching
 */
export class AnalysisCacheService {
  
  /**
   * Cache analysis result
   */
  static async cacheResult(analysisId: string, result: any): Promise<boolean> {
    const key = `${CACHE_KEYS.ANALYSIS}${analysisId}`;
    return await CacheService.set(key, result, CACHE_TTL.ANALYSIS_RESULT);
  }

  /**
   * Get cached analysis result
   */
  static async getCachedResult<T>(analysisId: string): Promise<T | null> {
    const key = `${CACHE_KEYS.ANALYSIS}${analysisId}`;
    return await CacheService.get<T>(key);
  }

  /**
   * Cache statistical computation result
   */
  static async cacheStatisticalResult(computationHash: string, result: any): Promise<boolean> {
    const key = `${CACHE_KEYS.STATS}${computationHash}`;
    return await CacheService.set(key, result, CACHE_TTL.STATISTICAL_COMPUTATION);
  }

  /**
   * Get cached statistical computation result
   */
  static async getCachedStatisticalResult<T>(computationHash: string): Promise<T | null> {
    const key = `${CACHE_KEYS.STATS}${computationHash}`;
    return await CacheService.get<T>(key);
  }

  /**
   * Invalidate analysis cache for a dataset
   */
  static async invalidateDatasetAnalyses(datasetId: string): Promise<number> {
    const pattern = `${CACHE_KEYS.ANALYSIS}*:dataset:${datasetId}`;
    return await CacheService.deletePattern(pattern);
  }
}

/**
 * Query result caching
 */
export class QueryCacheService {
  
  /**
   * Cache database query result
   */
  static async cacheQuery(queryHash: string, result: any, ttl: number = CACHE_TTL.QUERY_RESULT): Promise<boolean> {
    const key = `${CACHE_KEYS.QUERY}${queryHash}`;
    return await CacheService.set(key, result, ttl);
  }

  /**
   * Get cached query result
   */
  static async getCachedQuery<T>(queryHash: string): Promise<T | null> {
    const key = `${CACHE_KEYS.QUERY}${queryHash}`;
    return await CacheService.get<T>(key);
  }

  /**
   * Generate query hash for caching
   */
  static generateQueryHash(query: string, params: any[] = []): string {
    const crypto = require('crypto');
    const content = query + JSON.stringify(params);
    return crypto.createHash('md5').update(content).digest('hex');
  }
}

/**
 * Graceful shutdown
 */
export async function closeRedis(): Promise<void> {
  try {
    if (redisClient && redisClient.isReady) {
      await redisClient.quit();
      console.log('✅ Redis connection closed gracefully');
    }
  } catch (error) {
    console.error('❌ Error closing Redis connection:', error);
  }
}

// Handle process termination
process.on('SIGINT', closeRedis);
process.on('SIGTERM', closeRedis);
process.on('beforeExit', closeRedis);