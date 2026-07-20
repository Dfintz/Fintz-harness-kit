"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncidentResponseService = void 0;
const data_source_1 = require("../../data-source");
const DataBreachNotification_1 = require("../../models/DataBreachNotification");
const User_1 = require("../../models/User");
const apiErrors_1 = require("../../utils/apiErrors");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
class IncidentResponseService {
    breachRepository;
    userRepository;
    notificationService;
    appUrl;
    securityEmail;
    legalEmail;
    constructor(notificationService) {
        this.breachRepository = data_source_1.AppDataSource.getRepository(DataBreachNotification_1.DataBreachNotification);
        this.userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
        this.notificationService = notificationService;
        this.appUrl = process.env.APP_URL || '';
        this.securityEmail = process.env.SECURITY_EMAIL || '';
        this.legalEmail = process.env.LEGAL_EMAIL || '';
        if (!this.appUrl || !this.securityEmail || !this.legalEmail) {
            logger_1.logger.warn('Incident response service initialized without required environment variables', {
                hasAppUrl: !!this.appUrl,
                hasSecurityEmail: !!this.securityEmail,
                hasLegalEmail: !!this.legalEmail,
            });
        }
    }
    async reportBreach(incidentData) {
        logger_1.logger.warn('Data breach reported', {
            severity: incidentData.severity,
            affectedRecords: incidentData.affectedUsers.length,
        });
        const incident = new DataBreachNotification_1.DataBreachNotification();
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
        const savedIncident = await this.breachRepository.save(incident);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            message: `Data breach reported: ${incident.title}`,
            metadata: {
                incidentId: savedIncident.id,
                severity: incident.severity,
                affectedUserCount: incident.affectedUsers.length,
                affectedDataTypes: incident.affectedDataTypes,
            },
        });
        if (incidentData.severity === 'critical') {
            await this.notifyAdmins(savedIncident);
        }
        return savedIncident;
    }
    async notifyAffectedUsers(incident) {
        logger_1.logger.info('Notifying affected users of breach', {
            incidentId: incident.id,
            userCount: incident.affectedUsers.length,
        });
        for (const userId of incident.affectedUsers) {
            try {
                const user = await this.userRepository.findOne({ where: { id: userId } });
                if (!user?.email) {
                    logger_1.logger.warn('User not found or no email', { userId });
                    continue;
                }
                const subject = this.getNotificationSubject(incident);
                const body = this.getNotificationBody(incident, user);
                if (this.notificationService) {
                    await this.notificationService.sendEmailNotification({
                        subject,
                        body,
                        recipientEmails: [user.email],
                    });
                }
                incident.notifiedUsers.push({
                    userId,
                    notifiedAt: new Date(),
                    status: 'SENT',
                });
                logger_1.logger.info('User notified of breach', { userId, incidentId: incident.id });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                logger_1.logger.error('Failed to notify user of breach', { userId, error: errorMessage });
                incident.notificationErrors.push({
                    userId,
                    error: errorMessage,
                    retryCount: 0,
                });
            }
        }
        incident.status = 'NOTIFIED';
        incident.notifiedAt = new Date();
        await this.breachRepository.save(incident);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            message: `Breach notifications sent: ${incident.title}`,
            metadata: {
                incidentId: incident.id,
                notifiedCount: incident.notifiedUsers.length,
                errorCount: incident.notificationErrors.length,
            },
        });
    }
    async generateBreachReport(incident) {
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
    async getById(id) {
        return this.breachRepository.findOne({ where: { id } });
    }
    async listIncidents() {
        return this.breachRepository.find({
            order: {
                discoveredAt: 'DESC',
            },
        });
    }
    async updateStatus(id, status) {
        const incident = await this.getById(id);
        if (!incident) {
            throw new apiErrors_1.NotFoundError('Incident');
        }
        incident.status = status;
        if (status === 'CONTAINED' && !incident.containedAt) {
            incident.containedAt = new Date();
        }
        else if (status === 'RESOLVED' && !incident.resolvedAt) {
            incident.resolvedAt = new Date();
        }
        return this.breachRepository.save(incident);
    }
    async addRemediationStep(id, step) {
        const incident = await this.getById(id);
        if (!incident) {
            throw new apiErrors_1.NotFoundError('Incident');
        }
        incident.remediationSteps.push(step);
        return this.breachRepository.save(incident);
    }
    async addRecommendation(id, recommendation) {
        const incident = await this.getById(id);
        if (!incident) {
            throw new apiErrors_1.NotFoundError('Incident');
        }
        incident.recommendations.push(recommendation);
        return this.breachRepository.save(incident);
    }
    getNotificationSubject(incident) {
        return `Security Alert: ${incident.title}`;
    }
    getNotificationBody(incident, user) {
        if (!this.appUrl || !this.securityEmail || !this.legalEmail) {
            logger_1.logger.error('Missing required environment variables for breach notification', {
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
    assessRiskLevel(incident) {
        if (incident.severity === 'critical') {
            return 'HIGH';
        }
        if (incident.severity === 'high') {
            return 'MEDIUM';
        }
        return 'LOW';
    }
    assessPotentialImpact(incident) {
        const dataTypes = incident.affectedDataTypes;
        if (dataTypes.includes('PASSWORD') || dataTypes.includes('PAYMENT')) {
            return 'SEVERE - Sensitive financial/identity data exposed';
        }
        if (dataTypes.includes('EMAIL') || dataTypes.includes('USERNAME')) {
            return 'MODERATE - Personal identifying information exposed';
        }
        return 'LOW - General fleet/gaming data exposed';
    }
    async notifyAdmins(incident) {
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
            const securityWebhookUrl = process.env.SECURITY_WEBHOOK_URL;
            if (securityWebhookUrl) {
                if (typeof fetch !== 'function') {
                    logger_1.logger.error('Security webhook URL is configured but fetch is not available in this runtime');
                }
                else {
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
                            let responseBody;
                            try {
                                responseBody = await response.text();
                            }
                            catch (readError) {
                                logger_1.logger.error('Failed to read security webhook error response body', { readError });
                            }
                            logger_1.logger.error('Security webhook responded with non-OK status', {
                                status: response.status,
                                statusText: response.statusText,
                                responseBody,
                            });
                        }
                    }
                    catch (error) {
                        logger_1.logger.error('Failed to notify security webhook', { error });
                    }
                }
            }
            logger_1.logger.info('Admin notifications sent for critical incident', { incidentId: incident.id });
        }
        catch (error) {
            logger_1.logger.error('Failed to notify admins', { error });
        }
    }
}
exports.IncidentResponseService = IncidentResponseService;
//# sourceMappingURL=IncidentResponseService.js.map