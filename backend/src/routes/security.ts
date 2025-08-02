import { Router, Request, Response } from 'express';
import { auditLogger } from '../lib/audit-logger.js';
import { securityMonitor } from '../lib/security-monitor.js';
import { errorLogger } from '../lib/error-logger.js';
import { validateApiKey, auditLog } from '../middleware/security.js';

const router: Router = Router();

// Apply API key validation for all security endpoints
router.use(validateApiKey);

/**
 * Security metrics endpoint for monitoring systems
 * Requires API key authentication
 */
router.get('/metrics', auditLog('security_metrics_access'), (req: Request, res: Response) => {
  try {
    const auditMetrics = auditLogger.getSecurityMetrics();
    const monitorMetrics = securityMonitor.getMetrics();
    const errorMetrics = errorLogger.getMetrics();

    const securityMetrics = {
      timestamp: new Date().toISOString(),
      audit: {
        totalEvents: auditMetrics.totalEvents,
        totalSecurityEvents: auditMetrics.totalSecurityEvents,
        eventsLast24h: auditMetrics.eventsLast24h,
        highRiskEventsLast24h: auditMetrics.highRiskEventsLast24h,
        eventsByThreatType: auditMetrics.eventsByThreatType,
        eventsBySeverity: auditMetrics.eventsBySeverity
      },
      monitor: {
        alertsLast24h: monitorMetrics.alertsLast24h,
        alertsByLevel: monitorMetrics.alertsByLevel,
        alertsByType: monitorMetrics.alertsByType,
        blockedRequests: monitorMetrics.blockedRequests,
        suspiciousActivities: monitorMetrics.suspiciousActivities,
        topAttackSources: monitorMetrics.topAttackSources.slice(0, 5) // Limit to top 5
      },
      errors: {
        totalErrors: errorMetrics.totalErrors,
        errorRate: errorMetrics.errorRate,
        recentErrorCount: errorMetrics.recentErrors.length
      }
    };

    auditLogger.logDataAccessEvent('read', 'security_metrics', req, {
      recordCount: Object.keys(securityMetrics).length,
      sensitive: true
    });

    res.json(securityMetrics);
  } catch (error) {
    errorLogger.logError(error as Error, req, { endpoint: 'security-metrics' });
    res.status(500).json({
      error: 'Failed to retrieve security metrics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Security alerts endpoint for monitoring systems
 * Returns recent high-priority security alerts
 */
router.get('/alerts', auditLog('security_alerts_access'), (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const level = req.query.level as string;
    const type = req.query.type as string;

    const filters: any = {};
    if (level && ['low', 'medium', 'high', 'critical'].includes(level)) {
      filters.level = level;
    }
    if (type) {
      filters.type = type;
    }

    const alerts = securityMonitor.getAlerts(limit, filters);
    const securityEvents = auditLogger.getSecurityEvents(limit, {
      severity: level,
      threatType: type
    });

    auditLogger.logDataAccessEvent('read', 'security_alerts', req, {
      recordCount: alerts.length + securityEvents.length,
      sensitive: true,
      details: { filters, limit }
    });

    res.json({
      timestamp: new Date().toISOString(),
      alerts: alerts.map(alert => ({
        id: alert.id,
        timestamp: alert.timestamp,
        level: alert.level,
        type: alert.type,
        source: {
          ip: alert.source.ip,
          endpoint: alert.source.endpoint
        },
        riskFactors: alert.riskAssessment.factors,
        actions: alert.actions
      })),
      securityEvents: securityEvents.map(event => ({
        id: event.id,
        timestamp: event.timestamp,
        action: event.action,
        threatType: event.threatType,
        severity: event.severity,
        ipAddress: event.ipAddress,
        success: event.success
      }))
    });
  } catch (error) {
    errorLogger.logError(error as Error, req, { endpoint: 'security-alerts' });
    res.status(500).json({
      error: 'Failed to retrieve security alerts',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Blocked IPs endpoint for security monitoring
 */
router.get('/blocked-ips', auditLog('blocked_ips_access'), (req: Request, res: Response) => {
  try {
    const blockedIPs = securityMonitor.getBlockedIPs();
    const suspiciousIPs = securityMonitor.getSuspiciousIPs();

    auditLogger.logDataAccessEvent('read', 'blocked_ips', req, {
      recordCount: blockedIPs.length + suspiciousIPs.length,
      sensitive: true
    });

    res.json({
      timestamp: new Date().toISOString(),
      blockedIPs: blockedIPs.map(ip => ({ ip, status: 'blocked' })),
      suspiciousIPs: suspiciousIPs.map(({ ip, count }) => ({ ip, count, status: 'suspicious' }))
    });
  } catch (error) {
    errorLogger.logError(error as Error, req, { endpoint: 'blocked-ips' });
    res.status(500).json({
      error: 'Failed to retrieve blocked IPs',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Security configuration status endpoint
 */
router.get('/config-status', auditLog('security_config_access'), (req: Request, res: Response) => {
  try {
    const configStatus = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      security: {
        httpsEnforced: process.env.NODE_ENV === 'production',
        rateLimitingEnabled: true,
        corsConfigured: true,
        inputSanitizationEnabled: true,
        auditLoggingEnabled: process.env.AUDIT_LOG_ENABLED !== 'false',
        encryptionEnabled: !!process.env.ENCRYPTION_KEY,
        apiKeyProtectionEnabled: !!process.env.API_KEYS,
        securityHeadersEnabled: true,
        fileUploadSecurityEnabled: true
      },
      monitoring: {
        securityMonitoringEnabled: true,
        errorLoggingEnabled: true,
        performanceMonitoringEnabled: true,
        webhookNotificationsConfigured: !!process.env.SECURITY_EVENT_WEBHOOK_URL
      }
    };

    auditLogger.logDataAccessEvent('read', 'security_config', req, {
      sensitive: false,
      details: { environment: process.env.NODE_ENV }
    });

    res.json(configStatus);
  } catch (error) {
    errorLogger.logError(error as Error, req, { endpoint: 'security-config-status' });
    res.status(500).json({
      error: 'Failed to retrieve security configuration status',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Security health check endpoint
 */
router.get('/health', auditLog('security_health_check'), (req: Request, res: Response) => {
  try {
    const auditMetrics = auditLogger.getSecurityMetrics();
    const monitorMetrics = securityMonitor.getMetrics();
    
    // Determine health status based on security metrics
    const criticalAlerts = monitorMetrics.alertsByLevel.critical || 0;
    const highAlerts = monitorMetrics.alertsByLevel.high || 0;
    const highRiskEvents = auditMetrics.highRiskEventsLast24h;
    
    let status = 'healthy';
    let issues: string[] = [];
    
    if (criticalAlerts > 0) {
      status = 'critical';
      issues.push(`${criticalAlerts} critical security alerts`);
    } else if (highAlerts > 5) {
      status = 'warning';
      issues.push(`${highAlerts} high-priority security alerts`);
    } else if (highRiskEvents > 10) {
      status = 'warning';
      issues.push(`${highRiskEvents} high-risk security events in last 24h`);
    }
    
    const healthStatus = {
      timestamp: new Date().toISOString(),
      status,
      issues,
      metrics: {
        criticalAlerts,
        highAlerts,
        highRiskEventsLast24h: highRiskEvents,
        blockedIPs: monitorMetrics.blockedRequests,
        suspiciousActivities: monitorMetrics.suspiciousActivities
      }
    };

    auditLogger.logDataAccessEvent('read', 'security_health', req, {
      sensitive: false,
      details: { status, issueCount: issues.length }
    });

    const statusCode = status === 'critical' ? 503 : status === 'warning' ? 200 : 200;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    errorLogger.logError(error as Error, req, { endpoint: 'security-health' });
    res.status(500).json({
      status: 'error',
      error: 'Security health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Emergency IP unblock endpoint (for authorized administrators)
 */
router.post('/unblock-ip', auditLog('emergency_ip_unblock'), (req: Request, res: Response) => {
  try {
    const { ip, reason } = req.body;
    
    if (!ip) {
      return res.status(400).json({
        error: 'IP address is required',
        timestamp: new Date().toISOString()
      });
    }

    // Validate IP format
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip)) {
      return res.status(400).json({
        error: 'Invalid IP address format',
        timestamp: new Date().toISOString()
      });
    }

    const wasBlocked = securityMonitor.isIPBlocked(ip);
    securityMonitor.unblockIP(ip);

    auditLogger.logSecurityEvent(
      'emergency_ip_unblock',
      'authorization',
      'warning',
      req,
      {
        resource: 'security_admin',
        success: true,
        details: { 
          ip, 
          reason: reason || 'Emergency unblock via API',
          wasBlocked,
          adminAction: true
        }
      }
    );

    return res.json({
      success: true,
      message: `IP ${ip} has been ${wasBlocked ? 'unblocked' : 'removed from suspicious list'}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    errorLogger.logError(error as Error, req, { endpoint: 'emergency-ip-unblock' });
    return res.status(500).json({
      error: 'Failed to unblock IP address',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;