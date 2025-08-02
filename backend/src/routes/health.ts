import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const router = Router();
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy';
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
  };
}

// Basic health check
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthCheck: HealthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      services: {
        database: 'healthy',
        redis: 'healthy',
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
        },
        cpu: {
          usage: process.cpuUsage().user / 1000000 // Convert to seconds
        }
      }
    };

    // Check database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      healthCheck.services.database = 'unhealthy';
      healthCheck.status = 'unhealthy';
    }

    // Check Redis connection
    try {
      await redis.ping();
    } catch (error) {
      healthCheck.services.redis = 'unhealthy';
      healthCheck.status = 'unhealthy';
    }

    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthCheck);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Detailed health check for monitoring systems
router.get('/health/detailed', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Database health check with timing
    let dbHealth = 'healthy';
    let dbResponseTime = 0;
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT COUNT(*) FROM users`;
      dbResponseTime = Date.now() - dbStart;
    } catch (error) {
      dbHealth = 'unhealthy';
    }

    // Redis health check with timing
    let redisHealth = 'healthy';
    let redisResponseTime = 0;
    try {
      const redisStart = Date.now();
      await redis.ping();
      redisResponseTime = Date.now() - redisStart;
    } catch (error) {
      redisHealth = 'unhealthy';
    }

    const totalResponseTime = Date.now() - startTime;
    const memUsage = process.memoryUsage();

    const detailedHealth = {
      status: dbHealth === 'healthy' && redisHealth === 'healthy' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      responseTime: totalResponseTime,
      services: {
        database: {
          status: dbHealth,
          responseTime: dbResponseTime
        },
        redis: {
          status: redisHealth,
          responseTime: redisResponseTime
        }
      },
      system: {
        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external,
          arrayBuffers: memUsage.arrayBuffers
        },
        cpu: process.cpuUsage(),
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version
      }
    };

    const statusCode = detailedHealth.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(detailedHealth);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Detailed health check failed'
    });
  }
});

// Readiness probe
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if all critical services are ready
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Service not ready'
    });
  }
});

// Liveness probe
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;