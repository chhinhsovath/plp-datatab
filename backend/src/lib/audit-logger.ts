import { Request } from 'express';
import { errorLogger } from './error-logger.js';
import { maskSensitiveData } from './encryption.js';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  userId?: string;
  userEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  details?: any;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
}

export interface SecurityEvent extends AuditEvent {
  threatType: 'authentication' | 'authorization' | 'injection' | 'xss' | 'csrf' | 'rate_limit' | 'file_upload' | 'data_access';
  severity: 'info' | 'warning' | 'error' | 'critical';
}

class AuditLogger {
  private events: AuditEvent[] = [];
  private securityEvents: SecurityEvent[] = [];
  private maxEvents = 10000; // Keep last 10k events in memory
  private maxSecurityEvents = 5000; // Keep last 5k security events

  /**
   * Log a general audit event
   */
  logAuditEvent(
    action: string,
    resource: string,
    req?: Request,
    options: {
      resourceId?: string;
      success?: boolean;
      details?: any;
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
      tags?: string[];
      userId?: string;
      userEmail?: string;
    } = {}
  ): void {
    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      userId: options.userId || req?.user?.id,
      userEmail: options.userEmail || req?.user?.email,
      action,
      resource,
      resourceId: options.resourceId,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.get('User-Agent'),
      success: options.success ?? true,
      details: maskSensitiveData(options.details),
      riskLevel: options.riskLevel || 'low',
      tags: options.tags || []
    };

    this.events.push(event);
    this.trimEvents();

    // Log to error logger for persistence
    errorLogger.logError(
      new Error(`Audit: ${action} on ${resource}`),
      req,
      {
        auditEvent: event,
        type: 'audit'
      },
      ['audit', ...event.tags]
    );

    // Log high-risk events to console
    if (event.riskLevel === 'high' || event.riskLevel === 'critical') {
      console.warn('🚨 High-risk audit event:', {
        action: event.action,
        resource: event.resource,
        userId: event.userId,
        ipAddress: event.ipAddress,
        riskLevel: event.riskLevel
      });
    }
  }

  /**
   * Log a security-specific event
   */
  logSecurityEvent(
    action: string,
    threatType: SecurityEvent['threatType'],
    severity: SecurityEvent['severity'],
    req?: Request,
    options: {
      resource?: string;
      resourceId?: string;
      success?: boolean;
      details?: any;
      tags?: string[];
    } = {}
  ): void {
    const riskLevel = this.mapSeverityToRisk(severity);
    
    const securityEvent: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      userId: req?.user?.id,
      userEmail: req?.user?.email,
      action,
      resource: options.resource || 'security',
      resourceId: options.resourceId,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.get('User-Agent'),
      success: options.success ?? false,
      details: maskSensitiveData(options.details),
      riskLevel,
      tags: ['security', threatType, ...(options.tags || [])],
      threatType,
      severity
    };

    this.securityEvents.push(securityEvent);
    this.events.push(securityEvent);
    this.trimEvents();
    this.trimSecurityEvents();

    // Log to error logger for persistence
    errorLogger.logError(
      new Error(`Security: ${action} - ${threatType}`),
      req,
      {
        securityEvent,
        type: 'security'
      },
      ['security', threatType, severity]
    );

    // Always log security events to console
    const logLevel = severity === 'critical' ? 'error' : severity === 'error' ? 'error' : 'warn';
    console[logLevel](`🔒 Security event [${severity.toUpperCase()}]:`, {
      action: securityEvent.action,
      threatType: securityEvent.threatType,
      userId: securityEvent.userId,
      ipAddress: securityEvent.ipAddress,
      success: securityEvent.success
    });
  }

  /**
   * Log authentication events
   */
  logAuthEvent(
    action: 'login' | 'logout' | 'register' | 'password_reset' | 'token_refresh',
    req: Request,
    options: {
      success: boolean;
      userId?: string;
      userEmail?: string;
      details?: any;
    }
  ): void {
    const severity = options.success ? 'info' : 'warning';
    
    this.logSecurityEvent(
      action,
      'authentication',
      severity,
      req,
      {
        resource: 'user_auth',
        resourceId: options.userId,
        success: options.success,
        details: {
          userEmail: options.userEmail,
          ...options.details
        }
      }
    );
  }

  /**
   * Log authorization events
   */
  logAuthzEvent(
    action: string,
    resource: string,
    req: Request,
    options: {
      success: boolean;
      resourceId?: string;
      requiredPermission?: string;
      details?: any;
    }
  ): void {
    const severity = options.success ? 'info' : 'error';
    
    this.logSecurityEvent(
      action,
      'authorization',
      severity,
      req,
      {
        resource,
        resourceId: options.resourceId,
        success: options.success,
        details: {
          requiredPermission: options.requiredPermission,
          ...options.details
        }
      }
    );
  }

  /**
   * Log data access events
   */
  logDataAccessEvent(
    action: 'read' | 'write' | 'delete' | 'export',
    resource: string,
    req: Request,
    options: {
      resourceId?: string;
      recordCount?: number;
      sensitive?: boolean;
      details?: any;
    } = {}
  ): void {
    const riskLevel = options.sensitive ? 'high' : 'medium';
    const severity = options.sensitive ? 'warning' : 'info';
    
    this.logSecurityEvent(
      `data_${action}`,
      'data_access',
      severity,
      req,
      {
        resource,
        resourceId: options.resourceId,
        success: true,
        details: {
          recordCount: options.recordCount,
          sensitive: options.sensitive,
          ...options.details
        },
        tags: [riskLevel]
      }
    );
  }

  /**
   * Log file upload security events
   */
  logFileUploadEvent(
    req: Request,
    options: {
      filename: string;
      fileSize: number;
      mimeType: string;
      success: boolean;
      blocked?: boolean;
      reason?: string;
    }
  ): void {
    const severity = options.blocked ? 'error' : options.success ? 'info' : 'warning';
    
    this.logSecurityEvent(
      'file_upload',
      'file_upload',
      severity,
      req,
      {
        resource: 'file_system',
        success: options.success,
        details: {
          filename: options.filename,
          fileSize: options.fileSize,
          mimeType: options.mimeType,
          blocked: options.blocked,
          reason: options.reason
        }
      }
    );
  }

  /**
   * Get recent audit events
   */
  getAuditEvents(limit: number = 100, filters?: {
    userId?: string;
    action?: string;
    resource?: string;
    riskLevel?: string;
    startDate?: Date;
    endDate?: Date;
  }): AuditEvent[] {
    let events = [...this.events];

    if (filters) {
      events = events.filter(event => {
        if (filters.userId && event.userId !== filters.userId) return false;
        if (filters.action && !event.action.includes(filters.action)) return false;
        if (filters.resource && !event.resource.includes(filters.resource)) return false;
        if (filters.riskLevel && event.riskLevel !== filters.riskLevel) return false;
        if (filters.startDate && event.timestamp < filters.startDate) return false;
        if (filters.endDate && event.timestamp > filters.endDate) return false;
        return true;
      });
    }

    return events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get recent security events
   */
  getSecurityEvents(limit: number = 100, filters?: {
    threatType?: string;
    severity?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }): SecurityEvent[] {
    let events = [...this.securityEvents];

    if (filters) {
      events = events.filter(event => {
        if (filters.threatType && event.threatType !== filters.threatType) return false;
        if (filters.severity && event.severity !== filters.severity) return false;
        if (filters.userId && event.userId !== filters.userId) return false;
        if (filters.startDate && event.timestamp < filters.startDate) return false;
        if (filters.endDate && event.timestamp > filters.endDate) return false;
        return true;
      });
    }

    return events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(): {
    totalEvents: number;
    totalSecurityEvents: number;
    eventsByThreatType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    eventsLast24h: number;
    highRiskEventsLast24h: number;
  } {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const eventsByThreatType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};
    let eventsLast24h = 0;
    let highRiskEventsLast24h = 0;

    this.securityEvents.forEach(event => {
      eventsByThreatType[event.threatType] = (eventsByThreatType[event.threatType] || 0) + 1;
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
      
      if (event.timestamp > last24h) {
        eventsLast24h++;
        if (event.riskLevel === 'high' || event.riskLevel === 'critical') {
          highRiskEventsLast24h++;
        }
      }
    });

    return {
      totalEvents: this.events.length,
      totalSecurityEvents: this.securityEvents.length,
      eventsByThreatType,
      eventsBySeverity,
      eventsLast24h,
      highRiskEventsLast24h
    };
  }

  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapSeverityToRisk(severity: SecurityEvent['severity']): AuditEvent['riskLevel'] {
    switch (severity) {
      case 'critical': return 'critical';
      case 'error': return 'high';
      case 'warning': return 'medium';
      case 'info': return 'low';
      default: return 'low';
    }
  }

  private trimEvents(): void {
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  private trimSecurityEvents(): void {
    if (this.securityEvents.length > this.maxSecurityEvents) {
      this.securityEvents = this.securityEvents.slice(-this.maxSecurityEvents);
    }
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();