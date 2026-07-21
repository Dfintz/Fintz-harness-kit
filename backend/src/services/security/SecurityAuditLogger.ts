import { AuditCategory } from '../audit/AuditService';
import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';

/**
 * Security audit event types for comprehensive logging.
 * Tracks security-related operations and potential threats.
 */
export enum SecurityAuditAction {
  SECURITY_INCIDENT_REPORTED = 'SECURITY_INCIDENT_REPORTED',
  SECURITY_VULNERABILITY_PATCHED = 'SECURITY_VULNERABILITY_PATCHED',
  SUSPICIOUS_ACTIVITY_DETECTED = 'SUSPICIOUS_ACTIVITY_DETECTED',
  BRUTE_FORCE_ATTEMPT = 'BRUTE_FORCE_ATTEMPT',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',
  API_KEY_ROTATED = 'API_KEY_ROTATED',
  CERTIFICATE_RENEWED = 'CERTIFICATE_RENEWED',
  SECURITY_AUDIT_RUN = 'SECURITY_AUDIT_RUN',
}

/**
 * Security audit log entry interface
 */
export interface SecurityAuditEntry extends BaseDomainAuditEntry<SecurityAuditAction> {
  securityEventId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  sourceIp?: string;
  targetResource?: string;
}

/**
 * SecurityAuditLogger
 *
 * Domain-specific audit logger for security operations.
 */
export class SecurityAuditLogger extends DomainAuditLogger<
  SecurityAuditAction,
  SecurityAuditEntry
> {
  private static instance: SecurityAuditLogger;

  private constructor() {
    super({
      category: AuditCategory.SECURITY,
      domainLabel: 'Security',
    });
  }

  static getInstance(): SecurityAuditLogger {
    if (!SecurityAuditLogger.instance) {
      SecurityAuditLogger.instance = new SecurityAuditLogger();
    }
    return SecurityAuditLogger.instance;
  }

  static resetInstance(): void {
    if (process.env.NODE_ENV === 'test') {
      SecurityAuditLogger.instance = undefined as unknown as SecurityAuditLogger;
    }
  }

  protected buildMessage(entry: SecurityAuditEntry): string {
    return `Security ${entry.action}: [${entry.severity.toUpperCase()}] ${entry.description || entry.securityEventId}`;
  }

  protected buildResource(entry: SecurityAuditEntry): string {
    return `security/${entry.securityEventId}`;
  }

  logIncident(params: {
    organizationId: string;
    securityEventId: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description?: string;
    sourceIp?: string;
    targetResource?: string;
    performedById?: string;
    performedByName?: string;
  }): void {
    this.log({
      action: SecurityAuditAction.SECURITY_INCIDENT_REPORTED,
      securityEventId: params.securityEventId,
      severity: params.severity,
      description: params.description,
      sourceIp: params.sourceIp,
      targetResource: params.targetResource,
      organizationId: params.organizationId,
      performedById: params.performedById,
      performedByName: params.performedByName,
      details: {
        severity: params.severity,
        sourceIp: params.sourceIp,
        targetResource: params.targetResource,
      },
    });
  }
}

export const securityAuditLogger = SecurityAuditLogger.getInstance();

