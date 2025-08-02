import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { initializeDatabase, checkDatabaseConnection } from './lib/database.js';
import { initializeSocketService } from './lib/socket-service.js';
import { initializeRedis, closeRedis, isRedisAvailable } from './lib/redis.js';
import { JobQueue } from './lib/job-queue.js';
import { performanceMiddleware } from './lib/performance-monitor.js';
import { setupCDN } from './lib/cdn.js';
import { errorHandler, notFoundHandler, gracefulShutdown } from './middleware/error-handler.js';
import { errorLogger } from './lib/error-logger.js';
import { auditLogger } from './lib/audit-logger.js';
import {
  generalRateLimit,
  authRateLimit,
  uploadRateLimit,
  analysisRateLimit,
  corsOptions,
  helmetConfig,
  sanitizeInput,
  securityHeaders,
  enforceHTTPS,
  securityMonitoring,
  auditLog
} from './middleware/security.js';
import authRoutes from './routes/auth.js';
import uploadRoutes from './routes/upload.js';
import preprocessingRoutes from './routes/preprocessing.js';
import statisticalAnalysisRoutes from './routes/statistical-analysis.js';
import reportsRoutes from './routes/reports.js';
import collaborationRoutes from './routes/collaboration.js';
import securityRoutes from './routes/security.js';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Security middleware (order matters!)
app.use(enforceHTTPS); // Force HTTPS in production
app.use(securityHeaders); // Custom security headers
app.use(helmetConfig); // Enhanced helmet configuration
app.use(cors(corsOptions)); // Enhanced CORS configuration
app.use(securityMonitoring); // Security threat monitoring
app.use(generalRateLimit); // General rate limiting
app.use(morgan('combined')); // Request logging
app.use(performanceMiddleware()); // Performance monitoring
app.use(apmMiddleware); // APM monitoring
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(sanitizeInput); // Input sanitization

// Setup CDN and static asset optimization
setupCDN(app);

// Import APM service
import { apmService, apmMiddleware } from './lib/apm.js';

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbConnected = await checkDatabaseConnection();
    const redisConnected = isRedisAvailable();
    const queueStats = await JobQueue.getQueueStats();
    const errorMetrics = errorLogger.getMetrics();
    const securityMetrics = auditLogger.getSecurityMetrics();
    
    const status = dbConnected && redisConnected ? 'OK' : 'DEGRADED';
    
    // Log health check access
    auditLogger.logAuditEvent('health_check', 'system', req, {
      success: true,
      details: { status, dbConnected, redisConnected }
    });
    
    res.json({ 
      status,
      database: dbConnected ? 'connected' : 'disconnected',
      redis: redisConnected ? 'connected' : 'disconnected',
      jobQueue: queueStats,
      errorMetrics: {
        totalErrors: errorMetrics.totalErrors,
        errorRate: errorMetrics.errorRate,
        recentErrorCount: errorMetrics.recentErrors.length
      },
      securityMetrics: {
        totalSecurityEvents: securityMetrics.totalSecurityEvents,
        highRiskEventsLast24h: securityMetrics.highRiskEventsLast24h
      },
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    errorLogger.logError(error as Error, req, { endpoint: 'health-check' });
    auditLogger.logSecurityEvent('health_check_failed', 'data_access', 'error', req, {
      resource: 'system',
      success: false,
      details: { error: (error as Error).message }
    });
    res.status(500).json({
      status: 'ERROR',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Metrics endpoint for Prometheus
app.get('/health/metrics', (req, res) => {
  try {
    const metrics = apmService.getPrometheusMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    res.status(500).send('# Error generating metrics');
  }
});

// Detailed health check
app.get('/health/detailed', async (req, res) => {
  try {
    const dbConnected = await checkDatabaseConnection();
    const redisConnected = isRedisAvailable();
    const apmMetrics = apmService.getMetrics();
    const memoryUsage = process.memoryUsage();
    
    const detailedHealth = {
      status: dbConnected && redisConnected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      services: {
        database: {
          status: dbConnected ? 'healthy' : 'unhealthy'
        },
        redis: {
          status: redisConnected ? 'healthy' : 'unhealthy'
        }
      },
      performance: apmMetrics,
      system: {
        memory: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external
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

// API routes
app.get('/api/status', (_req, res) => {
  res.json({ 
    message: 'DataTab Clone API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Authentication routes (with strict rate limiting)
app.use('/api/auth', authRateLimit, auditLog('authentication'), authRoutes);

// Upload and data import routes (with upload rate limiting)
app.use('/api/upload', uploadRateLimit, auditLog('file_upload'), uploadRoutes);

// Data preprocessing routes
app.use('/api/preprocessing', auditLog('data_preprocessing'), preprocessingRoutes);

// Statistical analysis routes (with analysis rate limiting)
app.use('/api/analysis', analysisRateLimit, auditLog('statistical_analysis'), statisticalAnalysisRoutes);

// Reports routes
app.use('/api/reports', auditLog('report_generation'), reportsRoutes);

// Collaboration routes
app.use('/api/collaboration', auditLog('collaboration'), collaborationRoutes);

// Security monitoring routes (protected by API key)
app.use('/api/security', securityRoutes);

// Security and monitoring endpoints (for development/debugging)
if (process.env.NODE_ENV === 'development') {
  const { securityMonitor } = await import('./lib/security-monitor.js');
  
  app.get('/api/debug/errors', auditLog('debug_access'), (req, res) => {
    const metrics = errorLogger.getMetrics();
    auditLogger.logDataAccessEvent('read', 'error_logs', req, {
      recordCount: metrics.recentErrors.length,
      sensitive: false
    });
    res.json(metrics);
  });
  
  app.get('/api/debug/errors/:id', auditLog('debug_access'), (req, res) => {
    const error = errorLogger.getErrorById(req.params.id);
    if (!error) {
      return res.status(404).json({ error: 'Error not found' });
    }
    auditLogger.logDataAccessEvent('read', 'error_logs', req, {
      resourceId: req.params.id,
      sensitive: false
    });
    res.json(error);
  });

  app.get('/api/debug/security', auditLog('security_debug'), (req, res) => {
    const auditMetrics = auditLogger.getSecurityMetrics();
    const recentEvents = auditLogger.getSecurityEvents(50);
    const monitorMetrics = securityMonitor.getMetrics();
    const recentAlerts = securityMonitor.getAlerts(20);
    
    auditLogger.logDataAccessEvent('read', 'security_logs', req, {
      recordCount: recentEvents.length + recentAlerts.length,
      sensitive: true
    });
    
    res.json({ 
      audit: { metrics: auditMetrics, recentEvents },
      monitor: { metrics: monitorMetrics, recentAlerts }
    });
  });

  app.get('/api/debug/audit', auditLog('audit_debug'), (req, res) => {
    const events = auditLogger.getAuditEvents(100);
    auditLogger.logDataAccessEvent('read', 'audit_logs', req, {
      recordCount: events.length,
      sensitive: true
    });
    res.json(events);
  });

  app.get('/api/debug/security/blocked-ips', auditLog('security_debug'), (req, res) => {
    const blockedIPs = securityMonitor.getBlockedIPs();
    const suspiciousIPs = securityMonitor.getSuspiciousIPs();
    
    auditLogger.logDataAccessEvent('read', 'security_blocked_ips', req, {
      recordCount: blockedIPs.length + suspiciousIPs.length,
      sensitive: true
    });
    
    res.json({ blockedIPs, suspiciousIPs });
  });

  app.post('/api/debug/security/unblock-ip', auditLog('security_admin'), (req, res) => {
    const { ip } = req.body;
    if (!ip) {
      return res.status(400).json({ error: 'IP address required' });
    }
    
    securityMonitor.unblockIP(ip);
    auditLogger.logAuditEvent('ip_unblocked', 'security_admin', req, {
      success: true,
      details: { ip },
      riskLevel: 'medium'
    });
    
    res.json({ success: true, message: `IP ${ip} has been unblocked` });
  });
}

// 404 handler (must be before error handler)
app.use('*', notFoundHandler);

// Global error handling middleware (must be last)
app.use(errorHandler);

async function startServer() {
  try {
    // Initialize database connection
    await initializeDatabase();
    
    // Initialize Redis connection
    await initializeRedis();
    
    // Initialize job queue
    await JobQueue.initialize();
    
    // Initialize Socket.io service
    initializeSocketService(server);
    
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🔌 Socket.io enabled for real-time collaboration`);
      console.log(`⚡ Redis caching: ${isRedisAvailable() ? 'enabled' : 'disabled'}`);
      console.log(`🔄 Background job processing: enabled`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = gracefulShutdown(server);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  errorLogger.logError(error, undefined, { type: 'uncaught-exception' }, ['critical']);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  const error = reason instanceof Error ? reason : new Error(String(reason));
  errorLogger.logError(error, undefined, { type: 'unhandled-rejection' }, ['critical']);
});

startServer();