import axios from 'axios';
import { structuredLogger } from './logger';

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: Date;
  source: string;
  metadata?: Record<string, any>;
}

interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: Record<string, any>;
}

class AlertService {
  private alerts: Alert[] = [];
  private notificationChannels: NotificationChannel[] = [];

  constructor() {
    this.initializeChannels();
  }

  private initializeChannels() {
    // Email notifications
    if (process.env.SMTP_HOST) {
      this.notificationChannels.push({
        type: 'email',
        config: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 587,
          username: process.env.SMTP_USERNAME,
          password: process.env.SMTP_PASSWORD,
          from: process.env.SMTP_FROM || 'alerts@datatab.com',
          to: process.env.ALERT_EMAIL_TO?.split(',') || ['admin@datatab.com']
        }
      });
    }

    // Slack notifications
    if (process.env.SLACK_WEBHOOK_URL) {
      this.notificationChannels.push({
        type: 'slack',
        config: {
          webhookUrl: process.env.SLACK_WEBHOOK_URL,
          channel: process.env.SLACK_CHANNEL || '#alerts'
        }
      });
    }

    // Webhook notifications
    if (process.env.WEBHOOK_URL) {
      this.notificationChannels.push({
        type: 'webhook',
        config: {
          url: process.env.WEBHOOK_URL,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.WEBHOOK_AUTH_HEADER
          }
        }
      });
    }
  }

  // Create and send alert
  async createAlert(alert: Omit<Alert, 'id' | 'timestamp'>): Promise<void> {
    const fullAlert: Alert = {
      ...alert,
      id: this.generateAlertId(),
      timestamp: new Date()
    };

    this.alerts.push(fullAlert);

    // Log the alert
    structuredLogger.warn('Alert created', {
      alertId: fullAlert.id,
      severity: fullAlert.severity,
      title: fullAlert.title,
      source: fullAlert.source
    });

    // Send notifications
    await this.sendNotifications(fullAlert);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    const promises = this.notificationChannels.map(channel => 
      this.sendNotification(channel, alert)
    );

    try {
      await Promise.allSettled(promises);
    } catch (error) {
      structuredLogger.error('Failed to send alert notifications', {
        alertId: alert.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async sendNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    try {
      switch (channel.type) {
        case 'email':
          await this.sendEmailNotification(channel.config, alert);
          break;
        case 'slack':
          await this.sendSlackNotification(channel.config, alert);
          break;
        case 'webhook':
          await this.sendWebhookNotification(channel.config, alert);
          break;
        case 'sms':
          await this.sendSMSNotification(channel.config, alert);
          break;
      }
    } catch (error) {
      structuredLogger.error(`Failed to send ${channel.type} notification`, {
        alertId: alert.id,
        channelType: channel.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async sendEmailNotification(config: any, alert: Alert): Promise<void> {
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransporter({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.username,
        pass: config.password
      }
    });

    const mailOptions = {
      from: config.from,
      to: config.to.join(','),
      subject: `${alert.severity.toUpperCase()}: ${alert.title}`,
      html: `
        <h2>DataTab Alert</h2>
        <p><strong>Severity:</strong> ${alert.severity}</p>
        <p><strong>Title:</strong> ${alert.title}</p>
        <p><strong>Description:</strong> ${alert.description}</p>
        <p><strong>Source:</strong> ${alert.source}</p>
        <p><strong>Time:</strong> ${alert.timestamp.toISOString()}</p>
        ${alert.metadata ? `<p><strong>Metadata:</strong> ${JSON.stringify(alert.metadata, null, 2)}</p>` : ''}
      `
    };

    await transporter.sendMail(mailOptions);
  }

  private async sendSlackNotification(config: any, alert: Alert): Promise<void> {
    const color = alert.severity === 'critical' ? 'danger' : 
                  alert.severity === 'warning' ? 'warning' : 'good';

    const payload = {
      channel: config.channel,
      attachments: [{
        color,
        title: `${alert.severity.toUpperCase()}: ${alert.title}`,
        text: alert.description,
        fields: [
          {
            title: 'Source',
            value: alert.source,
            short: true
          },
          {
            title: 'Time',
            value: alert.timestamp.toISOString(),
            short: true
          }
        ],
        footer: 'DataTab Monitoring',
        ts: Math.floor(alert.timestamp.getTime() / 1000)
      }]
    };

    await axios.post(config.webhookUrl, payload);
  }

  private async sendWebhookNotification(config: any, alert: Alert): Promise<void> {
    await axios.post(config.url, alert, {
      headers: config.headers
    });
  }

  private async sendSMSNotification(config: any, alert: Alert): Promise<void> {
    // Implementation would depend on SMS provider (Twilio, AWS SNS, etc.)
    // This is a placeholder for SMS functionality
    structuredLogger.info('SMS notification would be sent', {
      alertId: alert.id,
      phoneNumbers: config.phoneNumbers
    });
  }

  // System health monitoring alerts
  async checkSystemHealth(): Promise<void> {
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    // Memory usage alert
    if (memoryUsagePercent > 90) {
      await this.createAlert({
        severity: 'critical',
        title: 'High Memory Usage',
        description: `Memory usage is at ${memoryUsagePercent.toFixed(2)}%`,
        source: 'system-monitor',
        metadata: { memoryUsage }
      });
    } else if (memoryUsagePercent > 80) {
      await this.createAlert({
        severity: 'warning',
        title: 'Elevated Memory Usage',
        description: `Memory usage is at ${memoryUsagePercent.toFixed(2)}%`,
        source: 'system-monitor',
        metadata: { memoryUsage }
      });
    }

    // CPU usage would require additional monitoring
    // Database connection health would be checked here
    // Redis connection health would be checked here
  }

  // Get recent alerts
  getRecentAlerts(limit: number = 50): Alert[] {
    return this.alerts.slice(-limit).reverse();
  }

  // Get alerts by severity
  getAlertsBySeverity(severity: Alert['severity'], limit: number = 50): Alert[] {
    return this.alerts
      .filter(alert => alert.severity === severity)
      .slice(-limit)
      .reverse();
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const alertService = new AlertService();

// Convenience functions for common alerts
export const createCriticalAlert = (title: string, description: string, source: string, metadata?: any) =>
  alertService.createAlert({ severity: 'critical', title, description, source, metadata });

export const createWarningAlert = (title: string, description: string, source: string, metadata?: any) =>
  alertService.createAlert({ severity: 'warning', title, description, source, metadata });

export const createInfoAlert = (title: string, description: string, source: string, metadata?: any) =>
  alertService.createAlert({ severity: 'info', title, description, source, metadata });