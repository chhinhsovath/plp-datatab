import { Request } from 'express';
import { auditLogger } from './audit-logger.js';
import { errorLogger } from './error-logger.js';
import { assessSecurityRisk, SecurityRiskAssessment } from './security-config.js';

export interface SecurityAlert {
  id: string;
  timestamp: Date;
  level: 'low' | 'medium' | 'high' | 'critical';
  type: 'rate_limit' | 'injection' | 'xss' | 'file_upload' | 'authentication' | 'authorization' | 'suspicious_activity';
  source: {
    ip: string;
    userAgent?: string;
    userId?: string;
    endpoint: string;
  };
  details: any;
  riskAssessment: SecurityRiskAssessment;
  actions: string[];
}

export interface SecurityMetrics {
  alertsLast24h: number;
  alertsByLevel: Record<string, number>;
  alertsByType: Record<string, number>;
  topAttackSources: Array<{ ip: string; count: number }>;
  blockedRequests: number;
  suspiciousActivities: number;
}

class SecurityMonitor {
  private alerts: SecurityAlert[] = [];
  private blockedIPs: Set<string> = new Set();
  private suspiciousIPs: Map<string, number> = new Map();
  private maxAlerts = 1000;

  /**
   * Monitor a request for security threats
   */
  monitorRequest(req: Request): SecurityRiskAssessment {
    const riskAssessment = assessSecurityRisk(req);
    
    // Log high-risk requests
    if (riskAssessment.level === 'high' || riskAssessment.level === 'critical') {
      this.createAlert({
        level: riskAssessment.level,
        type: 'suspicious_activity',
        source: {
          ip: req.ip || 'unknown',
          userAgent: req.get('User-Agent'),
          userId: req.user?.id,
          endpoint: req.path
        },
        details: {
          method: req.method,
          url: req.url,
          headers: this.sanitizeHeaders(req.headers),
          body: this.sanitizeBody(req.body)
        },
        riskAssessment
      });
    }

    // Track suspicious IPs
    const ip = req.ip || 'unknown';
    if (riskAssessment.level !== 'low') {
      const count = this.suspiciousIPs.get(ip) || 0;
      this.suspiciousIPs.set(ip, count + 1);
      
      // Auto-block IPs with too many suspicious activities
      if (count >= 10) {
        this.blockIP(ip, 'Excessive suspicious activities');
      }
    }

    return riskAssessment;
  }

  /**
   * Create a security alert
   */
  createAlert(alertData: Omit<SecurityAlert, 'id' | 'timestamp' | 'actions'>): SecurityAlert {
    const alert: SecurityAlert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      actions: this.determineActions(alertData.level, alertData.type),
      ...alertData
    };

    this.alerts.push(alert);
    this.trimAlerts();

    // Log the alert
    auditLogger.logSecurityEvent(
      `security_alert_${alertData.type}`,
      alertData.type as any,
      alertData.level === 'critical' ? 'critical' : 
      alertData.level === 'high' ? 'error' : 'warning',
      undefined,
      {
        resource: 'security_monitor',
        success: false,
        details: {
          alertId: alert.id,
          source: alert.source,
          riskFactors: alert.riskAssessment.factors
        }
      }
    );

    // Send webhook notification for high-priority alerts
    if (alert.level === 'high' || alert.level === 'critical') {
      this.sendWebhookNotification(alert);
    }

    return alert;
  }

  /**
   * Block an IP address
   */
  blockIP(ip: string, reason: string): void {
    this.blockedIPs.add(ip);
    
    auditLogger.logSecurityEvent(
      'ip_blocked',
      'authorization',
      'error',
      undefined,
      {
        resource: 'security_monitor',
        success: true,
        details: { ip, reason, timestamp: new Date().toISOString() }
      }
    );

    console.warn(`🚫 IP blocked: ${ip} - Reason: ${reason}`);
  }

  /**
   * Check if an IP is blocked
   */
  isIPBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }

  /**
   * Unblock an IP address
   */
  unblockIP(ip: string): void {
    this.blockedIPs.delete(ip);
    this.suspiciousIPs.delete(ip);
    
    auditLogger.logSecurityEvent(
      'ip_unblocked',
      'authorization',
      'info',
      undefined,
      {
        resource: 'security_monitor',
        success: true,
        details: { ip, timestamp: new Date().toISOString() }
      }
    );
  }

  /**
   * Get security metrics
   */
  getMetrics(): SecurityMetrics {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const alertsLast24h = this.alerts.filter(alert => alert.timestamp > last24h).length;
    
    const alertsByLevel: Record<string, number> = {};
    const alertsByType: Record<string, number> = {};
    
    this.alerts.forEach(alert => {
      alertsByLevel[alert.level] = (alertsByLevel[alert.level] || 0) + 1;
      alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
    });

    // Get top attack sources
    const ipCounts: Record<string, number> = {};
    this.alerts.forEach(alert => {
      const ip = alert.source.ip;
      ipCounts[ip] = (ipCounts[ip] || 0) + 1;
    });

    const topAttackSources = Object.entries(ipCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));

    return {
      alertsLast24h,
      alertsByLevel,
      alertsByType,
      topAttackSources,
      blockedRequests: this.blockedIPs.size,
      suspiciousActivities: this.suspiciousIPs.size
    };
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit: number = 100, filters?: {
    level?: string;
    type?: string;
    ip?: string;
    startDate?: Date;
    endDate?: Date;
  }): SecurityAlert[] {
    let alerts = [...this.alerts];

    if (filters) {
      alerts = alerts.filter(alert => {
        if (filters.level && alert.level !== filters.level) return false;
        if (filters.type && alert.type !== filters.type) return false;
        if (filters.ip && alert.source.ip !== filters.ip) return false;
        if (filters.startDate && alert.timestamp < filters.startDate) return false;
        if (filters.endDate && alert.timestamp > filters.endDate) return false;
        return true;
      });
    }

    return alerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get blocked IPs
   */
  getBlockedIPs(): string[] {
    return Array.from(this.blockedIPs);
  }

  /**
   * Get suspicious IPs
   */
  getSuspiciousIPs(): Array<{ ip: string; count: number }> {
    return Array.from(this.suspiciousIPs.entries())
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Clear old alerts and data
   */
  cleanup(): void {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Remove old alerts
    this.alerts = this.alerts.filter(alert => alert.timestamp > oneWeekAgo);
    
    // Reset suspicious IP counts periodically
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.suspiciousIPs.clear(); // Reset daily
    
    console.log('🧹 Security monitor cleanup completed');
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineActions(level: SecurityAlert['level'], type: SecurityAlert['type']): string[] {
    const actions: string[] = [];

    switch (level) {
      case 'critical':
        actions.push('immediate_investigation', 'consider_ip_block', 'notify_admin');
        break;
      case 'high':
        actions.push('investigate', 'monitor_closely');
        break;
      case 'medium':
        actions.push('log_and_monitor');
        break;
      case 'low':
        actions.push('log_only');
        break;
    }

    switch (type) {
      case 'injection':
        actions.push('sanitize_input', 'validate_parameters');
        break;
      case 'xss':
        actions.push('escape_output', 'validate_content');
        break;
      case 'file_upload':
        actions.push('scan_file', 'validate_mime_type');
        break;
      case 'authentication':
        actions.push('verify_credentials', 'check_session');
        break;
      case 'rate_limit':
        actions.push('throttle_requests', 'temporary_block');
        break;
    }

    return [...new Set(actions)]; // Remove duplicates
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized: any = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    
    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '***REDACTED***';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;
    
    const sanitized: any = {};
    const sensitiveFields = ['password', 'token', 'key', 'secret'];
    
    for (const [key, value] of Object.entries(body)) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '***REDACTED***';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  private trimAlerts(): void {
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }
  }

  private async sendWebhookNotification(alert: SecurityAlert): Promise<void> {
    const webhookUrl = process.env.SECURITY_EVENT_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DataTab-Security-Monitor/1.0'
        },
        body: JSON.stringify({
          alert: {
            id: alert.id,
            level: alert.level,
            type: alert.type,
            timestamp: alert.timestamp.toISOString(),
            source: alert.source,
            summary: `Security alert: ${alert.type} (${alert.level}) from ${alert.source.ip}`
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }
    } catch (error) {
      errorLogger.logError(
        error as Error,
        undefined,
        { webhookUrl, alertId: alert.id },
        ['security', 'webhook']
      );
    }
  }
}

// Export singleton instance
export const securityMonitor = new SecurityMonitor();

// Cleanup job - run every hour
setInterval(() => {
  securityMonitor.cleanup();
}, 60 * 60 * 1000);