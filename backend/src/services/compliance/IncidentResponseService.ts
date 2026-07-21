import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { DataBreachNotification, IncidentStatus } from '../../models/DataBreachNotification';
import { User } from '../../models/User';
import { NotFoundError } from '../../utils/apiErrors';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';
import { NotificationService } from '../communication/notifications/NotificationService';

export interface BreachReport {
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedUsers: string[];
  affectedDataTypes: string[];
}

export class IncidentResponseService {
  private readonly breachRepository: Repository<DataBreachNotification>;
  private readonly userRepository: Repository<User>;
  private notificationService?: NotificationService;
  private readonly appUrl: string;
  private readonly securityEmail: string;
  private readonly legalEmail: string;

  constructor(notificationService?: NotificationService) {
    this.breachRepository = AppDataSource.getRepository(DataBreachNotification);
    this.userRepository = AppDataSource.getRepository(User);
    this.notificationService = notificationService;

    // Validate required environment variables at initialization
    this.appUrl = process.env.APP_URL || '';
    this.securityEmail = process.env.SECURITY_EMAIL || '';
    this.legalEmail = process.env.LEGAL_EMAIL || '';

    if (!this.appUrl || !this.securityEmail || !this.legalEmail) {
      logger.warn('Incident response service initialized without required environment variables', {
        hasAppUrl: !!this.appUrl,
        hasSecurityEmail: !!this.securityEmail,
        hasLegalEmail: !!this.legalEmail,
      });
    }
  }

  /**
   * Report a new data breach incident
   */
  async reportBreach(incidentData: BreachReport): Promise<DataBreachNotification> {
    logger.warn('Data breach reported', {
      severity: incidentData.severity,
      affectedRecords: incidentData.affectedUsers.length,
    });

    // Create incident record
    const incident = new DataBreachNotification();
    incident.title = incidentData.title;
    incident.description = incidentData.description;
    incident.severity = incidentData.severity;
    incident.affectedUsers = incidentData.affectedUsers;
    incident.affectedDataTypes = incidentData.affectedDataTypes;
    incident.discoveredAt = new Date();
    incident.status = 'INVESTIGATING';
    incident.notifiedUsers = [];
    incident.notificationErrors = [];
    incident.remediationSteps = [];
    incident.recommendations = [];

    // Save to database
    const savedIncident = await this.breachRepository.save(incident);

    // Log audit event
    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      message: `Data breach reported: ${incident.title}`,
      metadata: {
        incidentId: savedIncident.id,
        severity: incident.severity,
        affectedUserCount: incident.affectedUsers.length,
        affectedDataTypes: incident.affectedDataTypes,
      },
    });

    // Trigger immediate notifications if critical
    if (incidentData.severity === 'critical') {
      await this.notifyAdmins(savedIncident);
    }

    return savedIncident;
  }

  /**
   * Notify affected users of a data breach
   */
  async notifyAffectedUsers(incident: DataBreachNotification): Promise<void> {
    logger.info('Notifying affected users of breach', {
      incidentId: incident.id,
      userCount: incident.affectedUsers.length,
    });

    for (const userId of incident.affectedUsers) {
      try {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user?.email) {
          logger.warn('User not found or no email', { userId });
          continue;
        }

        // Generate notification content
        const subject = this.getNotificationSubject(incident);
        const body = this.getNotificationBody(incident, user);

        // Send email notification if service is available
        if (this.notificationService) {
          await this.notificationService.sendEmailNotification({
            subject,
            body,
            recipientEmails: [user.email],
          });
        }

        // Record successful notification
        incident.notifiedUsers.push({
          userId,
          notifiedAt: new Date(),
          status: 'SENT',
        });

        logger.info('User notified of breach', { userId, incidentId: incident.id });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to notify user of breach', { userId, error: errorMessage });

        incident.notificationErrors.push({
          userId,
          error: errorMessage,
          retryCount: 0,
        });
      }
    }

    // Update incident status
    incident.status = 'NOTIFIED';
    incident.notifiedAt = new Date();
    await this.breachRepository.save(incident);

    // Log audit event
    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      message: `Breach notifications sent: ${incident.title}`,
      metadata: {
        incidentId: incident.id,
        notifiedCount: incident.notifiedUsers.length,
        errorCount: incident.notificationErrors.length,
      },
    });
  }

  /**
   * Generate formal GDPR-compliant breach report
   */
  async generateBreachReport(incident: DataBreachNotification): Promise<string> {
    const report = `
INCIDENT REPORT
===============
Incident ID: ${incident.id}
Title: ${incident.title}
Severity: ${incident.severity}
Discovered: ${incident.discoveredAt.toISOString()}

AFFECTED DATA
=============
Affected Users: ${incident.affectedUsers.length}
Data Types: ${incident.affectedDataTypes.join(', ')}

IMPACT ASSESSMENT
=================
Risk Level: ${this.assessRiskLevel(incident)}
Potential Impact: ${this.assessPotentialImpact(incident)}

REMEDIATION STEPS TAKEN
========================
${incident.remediationSteps.length > 0 ? incident.remediationSteps.map(step => `- ${step}`).join('\n') : 'No remediation steps recorded yet'}

COMMUNICATION
==============
Users Notified: ${incident.notifiedUsers.length}
Notification Date: ${incident.notifiedAt?.toISOString() || 'Not yet notified'}

RECOMMENDATIONS
================
${incident.recommendations.length > 0 ? incident.recommendations.map(rec => `- ${rec}`).join('\n') : 'No recommendations recorded yet'}

STATUS
======
Current Status: ${incident.status}
Contained: ${incident.containedAt?.toISOString() || 'Not yet contained'}
Resolved: ${incident.resolvedAt?.toISOString() || 'Not yet resolved'}

Report Generated: ${new Date().toISOString()}
`;

    return report;
  }

  /**
   * Get incident by ID
   */
  async getById(id: string): Promise<DataBreachNotification | null> {
    return this.breachRepository.findOne({ where: { id } });
  }

  /**
   * List all incidents
   */
  async listIncidents(): Promise<DataBreachNotification[]> {
    return this.breachRepository.find({
      order: {
        discoveredAt: 'DESC',
      },
    });
  }

  /**
   * Update incident status
   */
  async updateStatus(id: string, status: IncidentStatus): Promise<DataBreachNotification> {
    const incident = await this.getById(id);
    if (!incident) {
      throw new NotFoundError('Incident');
    }

    incident.status = status;

    // Set appropriate timestamp
    if (status === 'CONTAINED' && !incident.containedAt) {
      incident.containedAt = new Date();
    } else if (status === 'RESOLVED' && !incident.resolvedAt) {
      incident.resolvedAt = new Date();
    }

    return this.breachRepository.save(incident);
  }

  /**
   * Add remediation step to incident
   */
  async addRemediationStep(id: string, step: string): Promise<DataBreachNotification> {
    const incident = await this.getById(id);
    if (!incident) {
      throw new NotFoundError('Incident');
    }

    incident.remediationSteps.push(step);
    return this.breachRepository.save(incident);
  }

  /**
   * Add recommendation to incident
   */
  async addRecommendation(id: string, recommendation: string): Promise<DataBreachNotification> {
    const incident = await this.getById(id);
    if (!incident) {
      throw new NotFoundError('Incident');
    }

    incident.recommendations.push(recommendation);
    return this.breachRepository.save(incident);
  }

  /**
   * Get notification subject line
   */
  private getNotificationSubject(incident: DataBreachNotification): string {
    return `Security Alert: ${incident.title}`;
  }

  /**
   * Get notification body for user
   */
  private getNotificationBody(incident: DataBreachNotification, user: User): string {
    // Validate required environment variables (should have been validated at initialization)
    if (!this.appUrl || !this.securityEmail || !this.legalEmail) {
      logger.error('Missing required environment variables for breach notification', {
        hasAppUrl: !!this.appUrl,
        hasSecurityEmail: !!this.securityEmail,
        hasLegalEmail: !!this.legalEmail,
      });
      throw new Error('Missing required environment variables for breach notification');
    }

    return `
Dear ${user.username},

We are writing to inform you that we have discovered a security incident that may have affected your account.

WHAT HAPPENED
${incident.description}

WHAT INFORMATION WAS AFFECTED
${incident.affectedDataTypes.join(', ')}

WHAT WE ARE DOING
We have immediately contained the incident and begun a thorough investigation.
Your account has been secured and no unauthorized access has been detected.

WHAT YOU SHOULD DO
1. Change your password immediately
2. Enable two-factor authentication
3. Review your account activity
4. Contact us with any concerns

NEXT STEPS
We will continue to investigate and provide regular updates.
You can view more details at: ${this.appUrl}/settings/security/breach/${incident.id}

QUESTIONS?
Please contact our security team at ${this.securityEmail}
Or legal team at ${this.legalEmail}

Best regards,
Security Team
Star Citizen Fleet Manager
`;
  }

  /**
   * Assess risk level based on severity
   */
  private assessRiskLevel(incident: DataBreachNotification): string {
    if (incident.severity === 'critical') {
      return 'HIGH';
    }
    if (incident.severity === 'high') {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  /**
   * Assess potential impact based on data types
   */
  private assessPotentialImpact(incident: DataBreachNotification): string {
    const dataTypes = incident.affectedDataTypes;

    if (dataTypes.includes('PASSWORD') || dataTypes.includes('PAYMENT')) {
      return 'SEVERE - Sensitive financial/identity data exposed';
    }
    if (dataTypes.includes('EMAIL') || dataTypes.includes('USERNAME')) {
      return 'MODERATE - Personal identifying information exposed';
    }
    return 'LOW - General fleet/gaming data exposed';
  }

  /**
   * Notify administrators of a critical incident
   */
  private async notifyAdmins(incident: DataBreachNotification): Promise<void> {
    try {
      const admins = await this.userRepository.find({ where: { role: 'admin' } });
      const subject = `[CRITICAL] Security Incident: ${incident.title}`;
      const appUrl = process.env.APP_URL || 'https://fleet-manager.example.com';

      for (const admin of admins) {
        if (!admin.email) {
          continue;
        }

        const body = `
CRITICAL SECURITY INCIDENT

Incident ID: ${incident.id}
Title: ${incident.title}
Severity: ${incident.severity}
Affected Users: ${incident.affectedUsers.length}

Description:
${incident.description}

Dashboard: ${appUrl}/admin/incidents/${incident.id}

This requires immediate attention.
`;

        if (this.notificationService) {
          await this.notificationService.sendEmailNotification({
            subject,
            body,
            recipientEmails: [admin.email],
          });
        }
      }

      // Also log to security monitoring system via webhook
      const securityWebhookUrl = process.env.SECURITY_WEBHOOK_URL;
      if (securityWebhookUrl) {
        if (typeof fetch !== 'function') {
          logger.error(
            'Security webhook URL is configured but fetch is not available in this runtime'
          );
        } else {
          try {
            const response = await fetch(securityWebhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'SECURITY_INCIDENT',
                severity: incident.severity,
                title: incident.title,
                timestamp: new Date().toISOString(),
              }),
            });

            if (!response.ok) {
              let responseBody: string | undefined;
              try {
                responseBody = await response.text();
              } catch (readError: unknown) {
                logger.error('Failed to read security webhook error response body', { readError });
              }

              logger.error('Security webhook responded with non-OK status', {
                status: response.status,
                statusText: response.statusText,
                responseBody,
              });
            }
          } catch (error: unknown) {
            logger.error('Failed to notify security webhook', { error });
          }
        }
      }

      logger.info('Admin notifications sent for critical incident', { incidentId: incident.id });
    } catch (error: unknown) {
      logger.error('Failed to notify admins', { error });
    }
  }
}

