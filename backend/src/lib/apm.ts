import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

interface MetricData {
  timestamp: number;
  method: string;
  route: string;
  statusCode: number;
  responseTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
}

interface PerformanceMetrics {
  requests: {
    total: number;
    success: number;
    errors: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  system: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    uptime: number;
  };
  database: {
    connectionPool: {
      active: number;
      idle: number;
      total: number;
    };
    queryCount: number;
    averageQueryTime: number;
  };
}

class APMService {
  private metrics: MetricData[] = [];
  private startTime: number = Date.now();
  private requestCount: number = 0;
  private errorCount: number = 0;
  private responseTimes: number[] = [];
  private dbQueryCount: number = 0;
  private dbQueryTimes: number[] = [];

  // Middleware to track request metrics
  public requestTracker() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = performance.now();
      const startCpuUsage = process.cpuUsage();

      res.on('finish', () => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        const endCpuUsage = process.cpuUsage(startCpuUsage);

        const metric: MetricData = {
          timestamp: Date.now(),
          method: req.method,
          route: req.route?.path || req.path,
          statusCode: res.statusCode,
          responseTime,
          memoryUsage: process.memoryUsage(),
          cpuUsage: endCpuUsage
        };

        this.recordMetric(metric);
      });

      next();
    };
  }

  private recordMetric(metric: MetricData) {
    this.metrics.push(metric);
    this.requestCount++;
    this.responseTimes.push(metric.responseTime);

    if (metric.statusCode >= 400) {
      this.errorCount++;
    }

    // Keep only last 1000 metrics to prevent memory issues
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    // Keep only last 1000 response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
  }

  // Record database query metrics
  public recordDatabaseQuery(queryTime: number) {
    this.dbQueryCount++;
    this.dbQueryTimes.push(queryTime);

    // Keep only last 1000 query times
    if (this.dbQueryTimes.length > 1000) {
      this.dbQueryTimes = this.dbQueryTimes.slice(-1000);
    }
  }

  // Get current performance metrics
  public getMetrics(): PerformanceMetrics {
    const sortedResponseTimes = [...this.responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedResponseTimes.length * 0.95);
    const p99Index = Math.floor(sortedResponseTimes.length * 0.99);

    const averageResponseTime = this.responseTimes.length > 0 
      ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length 
      : 0;

    const averageQueryTime = this.dbQueryTimes.length > 0
      ? this.dbQueryTimes.reduce((sum, time) => sum + time, 0) / this.dbQueryTimes.length
      : 0;

    return {
      requests: {
        total: this.requestCount,
        success: this.requestCount - this.errorCount,
        errors: this.errorCount,
        averageResponseTime,
        p95ResponseTime: sortedResponseTimes[p95Index] || 0,
        p99ResponseTime: sortedResponseTimes[p99Index] || 0
      },
      system: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        uptime: process.uptime()
      },
      database: {
        connectionPool: {
          active: 0, // Would need to integrate with actual connection pool
          idle: 0,
          total: 0
        },
        queryCount: this.dbQueryCount,
        averageQueryTime
      }
    };
  }

  // Get metrics in Prometheus format
  public getPrometheusMetrics(): string {
    const metrics = this.getMetrics();
    
    return `
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total ${metrics.requests.total}

# HELP http_request_errors_total Total number of HTTP request errors
# TYPE http_request_errors_total counter
http_request_errors_total ${metrics.requests.errors}

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_sum ${metrics.requests.averageResponseTime * metrics.requests.total / 1000}
http_request_duration_seconds_count ${metrics.requests.total}
http_request_duration_seconds{quantile="0.95"} ${metrics.requests.p95ResponseTime / 1000}
http_request_duration_seconds{quantile="0.99"} ${metrics.requests.p99ResponseTime / 1000}

# HELP process_resident_memory_bytes Resident memory size in bytes
# TYPE process_resident_memory_bytes gauge
process_resident_memory_bytes ${metrics.system.memoryUsage.rss}

# HELP process_heap_bytes Process heap size in bytes
# TYPE process_heap_bytes gauge
process_heap_bytes ${metrics.system.memoryUsage.heapUsed}

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds counter
process_uptime_seconds ${metrics.system.uptime}

# HELP database_queries_total Total number of database queries
# TYPE database_queries_total counter
database_queries_total ${metrics.database.queryCount}

# HELP database_query_duration_seconds Average database query duration in seconds
# TYPE database_query_duration_seconds gauge
database_query_duration_seconds ${metrics.database.averageQueryTime / 1000}
    `.trim();
  }

  // Get recent error logs
  public getRecentErrors(limit: number = 50): MetricData[] {
    return this.metrics
      .filter(metric => metric.statusCode >= 400)
      .slice(-limit)
      .reverse();
  }

  // Get slow requests
  public getSlowRequests(threshold: number = 1000, limit: number = 50): MetricData[] {
    return this.metrics
      .filter(metric => metric.responseTime > threshold)
      .slice(-limit)
      .reverse();
  }

  // Reset metrics (useful for testing)
  public reset() {
    this.metrics = [];
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimes = [];
    this.dbQueryCount = 0;
    this.dbQueryTimes = [];
    this.startTime = Date.now();
  }
}

// Singleton instance
export const apmService = new APMService();

// Middleware export
export const apmMiddleware = apmService.requestTracker();

// Database query wrapper
export const trackDatabaseQuery = async <T>(
  queryFn: () => Promise<T>
): Promise<T> => {
  const startTime = performance.now();
  try {
    const result = await queryFn();
    const endTime = performance.now();
    apmService.recordDatabaseQuery(endTime - startTime);
    return result;
  } catch (error) {
    const endTime = performance.now();
    apmService.recordDatabaseQuery(endTime - startTime);
    throw error;
  }
};