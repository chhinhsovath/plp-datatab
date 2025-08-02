import { CacheService, CACHE_KEYS, CACHE_TTL } from './redis.js';

// Performance metrics interface
interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userId?: string;
}

interface DatabaseMetrics {
  query: string;
  executionTime: number;
  timestamp: Date;
  success: boolean;
  rowsAffected?: number;
}

interface StatisticalComputationMetrics {
  analysisType: string;
  datasetSize: number;
  computationTime: number;
  timestamp: Date;
  success: boolean;
  cacheHit?: boolean;
}

/**
 * Performance monitoring service
 */
export class PerformanceMonitor {
  private static metrics: PerformanceMetric[] = [];
  private static readonly MAX_METRICS_IN_MEMORY = 1000;

  /**
   * Record a performance metric
   */
  static async recordMetric(name: string, value: number, tags?: Record<string, string>): Promise<void> {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: new Date(),
      tags
    };

    // Store in memory (with rotation)
    this.metrics.push(metric);
    if (this.metrics.length > this.MAX_METRICS_IN_MEMORY) {
      this.metrics.shift();
    }

    // Store in Redis for persistence
    const key = `${CACHE_KEYS.STATS}metrics:${name}:${Date.now()}`;
    await CacheService.set(key, metric, CACHE_TTL.STATISTICAL_COMPUTATION);
  }

  /**
   * Record HTTP request metrics
   */
  static async recordRequest(metrics: RequestMetrics): Promise<void> {
    await this.recordMetric('http_request_duration', metrics.responseTime, {
      method: metrics.method,
      path: metrics.path,
      status_code: metrics.statusCode.toString(),
      user_id: metrics.userId || 'anonymous'
    });

    // Track request count
    await this.recordMetric('http_request_count', 1, {
      method: metrics.method,
      path: metrics.path,
      status_code: metrics.statusCode.toString()
    });
  }

  /**
   * Record database query metrics
   */
  static async recordDatabaseQuery(metrics: DatabaseMetrics): Promise<void> {
    await this.recordMetric('db_query_duration', metrics.executionTime, {
      success: metrics.success.toString(),
      rows_affected: metrics.rowsAffected?.toString() || '0'
    });

    // Track query count
    await this.recordMetric('db_query_count', 1, {
      success: metrics.success.toString()
    });
  }

  /**
   * Record statistical computation metrics
   */
  static async recordStatisticalComputation(metrics: StatisticalComputationMetrics): Promise<void> {
    await this.recordMetric('stats_computation_duration', metrics.computationTime, {
      analysis_type: metrics.analysisType,
      dataset_size: metrics.datasetSize.toString(),
      success: metrics.success.toString(),
      cache_hit: metrics.cacheHit?.toString() || 'false'
    });

    // Track computation count
    await this.recordMetric('stats_computation_count', 1, {
      analysis_type: metrics.analysisType,
      success: metrics.success.toString(),
      cache_hit: metrics.cacheHit?.toString() || 'false'
    });
  }

  /**
   * Get metrics summary
   */
  static getMetricsSummary(): {
    totalMetrics: number;
    recentMetrics: PerformanceMetric[];
    averageResponseTime: number;
    errorRate: number;
  } {
    const recentMetrics = this.metrics.slice(-100); // Last 100 metrics
    const requestMetrics = recentMetrics.filter(m => m.name === 'http_request_duration');
    const errorMetrics = recentMetrics.filter(m => 
      m.name === 'http_request_count' && 
      m.tags?.status_code && 
      parseInt(m.tags.status_code) >= 400
    );

    const averageResponseTime = requestMetrics.length > 0 
      ? requestMetrics.reduce((sum, m) => sum + m.value, 0) / requestMetrics.length 
      : 0;

    const errorRate = requestMetrics.length > 0 
      ? errorMetrics.length / requestMetrics.length 
      : 0;

    return {
      totalMetrics: this.metrics.length,
      recentMetrics,
      averageResponseTime,
      errorRate
    };
  }

  /**
   * Get system health metrics
   */
  static async getSystemHealth(): Promise<{
    memory: NodeJS.MemoryUsage;
    uptime: number;
    cpuUsage: NodeJS.CpuUsage;
    timestamp: Date;
  }> {
    return {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      cpuUsage: process.cpuUsage(),
      timestamp: new Date()
    };
  }

  /**
   * Clear old metrics
   */
  static clearOldMetrics(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);
  }
}

/**
 * Express middleware for performance monitoring
 */
export function performanceMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();

    // Override res.end to capture response time
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const responseTime = Date.now() - startTime;
      
      // Record metrics asynchronously
      PerformanceMonitor.recordRequest({
        method: req.method,
        path: req.route?.path || req.path,
        statusCode: res.statusCode,
        responseTime,
        timestamp: new Date(),
        userId: req.user?.id
      }).catch(err => console.error('Failed to record request metrics:', err));

      originalEnd.apply(this, args);
    };

    next();
  };
}

/**
 * Database query performance wrapper
 */
export function withDatabaseMetrics<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    let success = false;
    let rowsAffected = 0;

    try {
      const result = await queryFn();
      success = true;
      
      // Try to extract rows affected from result
      if (result && typeof result === 'object') {
        if ('count' in result) {
          rowsAffected = (result as any).count;
        } else if (Array.isArray(result)) {
          rowsAffected = result.length;
        }
      }

      resolve(result);
    } catch (error) {
      success = false;
      reject(error);
    } finally {
      const executionTime = Date.now() - startTime;
      
      PerformanceMonitor.recordDatabaseQuery({
        query: queryName,
        executionTime,
        timestamp: new Date(),
        success,
        rowsAffected
      }).catch(err => console.error('Failed to record database metrics:', err));
    }
  });
}

/**
 * Statistical computation performance wrapper
 */
export function withStatisticalMetrics<T>(
  analysisType: string,
  datasetSize: number,
  computationFn: () => Promise<T>,
  cacheHit: boolean = false
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    let success = false;

    try {
      const result = await computationFn();
      success = true;
      resolve(result);
    } catch (error) {
      success = false;
      reject(error);
    } finally {
      const computationTime = Date.now() - startTime;
      
      PerformanceMonitor.recordStatisticalComputation({
        analysisType,
        datasetSize,
        computationTime,
        timestamp: new Date(),
        success,
        cacheHit
      }).catch(err => console.error('Failed to record statistical metrics:', err));
    }
  });
}

/**
 * Memory usage tracker
 */
export class MemoryTracker {
  private static readonly MEMORY_THRESHOLD_MB = 500; // 500MB threshold
  private static lastCheck = Date.now();
  private static readonly CHECK_INTERVAL = 30000; // 30 seconds

  /**
   * Check memory usage and log warnings
   */
  static checkMemoryUsage(): void {
    const now = Date.now();
    if (now - this.lastCheck < this.CHECK_INTERVAL) {
      return;
    }

    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const externalMB = memUsage.external / 1024 / 1024;

    // Log memory usage
    PerformanceMonitor.recordMetric('memory_heap_used_mb', heapUsedMB);
    PerformanceMonitor.recordMetric('memory_heap_total_mb', heapTotalMB);
    PerformanceMonitor.recordMetric('memory_external_mb', externalMB);

    // Warn if memory usage is high
    if (heapUsedMB > this.MEMORY_THRESHOLD_MB) {
      console.warn(`⚠️  High memory usage detected: ${heapUsedMB.toFixed(2)}MB`);
    }

    this.lastCheck = now;
  }

  /**
   * Force garbage collection if available
   */
  static forceGarbageCollection(): void {
    if (global.gc) {
      global.gc();
      console.log('🗑️  Forced garbage collection');
    }
  }
}

/**
 * Performance optimization utilities
 */
export class PerformanceUtils {
  
  /**
   * Debounce function to limit function calls
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  /**
   * Throttle function to limit function calls
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Measure execution time of a function
   */
  static async measureTime<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    const result = await fn();
    const duration = Date.now() - startTime;
    
    console.log(`⏱️  ${name} took ${duration}ms`);
    await PerformanceMonitor.recordMetric(`execution_time_${name}`, duration);
    
    return { result, duration };
  }

  /**
   * Batch process array items to avoid blocking
   */
  static async batchProcess<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = 100,
    delayMs: number = 10
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(processor));
      results.push(...batchResults);
      
      // Small delay to prevent blocking
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    return results;
  }
}

// Start periodic memory checks
setInterval(() => {
  MemoryTracker.checkMemoryUsage();
}, 30000);

// Clear old metrics every hour
setInterval(() => {
  PerformanceMonitor.clearOldMetrics();
}, 60 * 60 * 1000);