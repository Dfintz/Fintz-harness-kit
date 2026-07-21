import { AuditCategory } from '../audit/AuditService';
import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';

/**
 * Intel audit event types for comprehensive logging.
 * Tracks intelligence gathering and information operations.
 */
export enum IntelAuditAction {
  INTEL_REPORT_FILED = 'INTEL_REPORT_FILED',
  INTEL_REPORT_UPDATED = 'INTEL_REPORT_UPDATED',
  INTEL_REPORT_SHARED = 'INTEL_REPORT_SHARED',
  INTEL_REPORT_ARCHIVED = 'INTEL_REPORT_ARCHIVED',
  INTEL_SOURCE_VERIFIED = 'INTEL_SOURCE_VERIFIED',
  INTEL_SOURCE_COMPROMISED = 'INTEL_SOURCE_COMPROMISED',
  INTEL_BRIEFING_CREATED = 'INTEL_BRIEFING_CREATED',
  INTEL_ANALYSIS_COMPLETED = 'INTEL_ANALYSIS_COMPLETED',
}

/**
 * Intel audit log entry interface
 */
export interface IntelAuditEntry extends BaseDomainAuditEntry<IntelAuditAction> {
  intelId: string;
  reportTitle: string;
  classificationLevel?: string;
  targetId?: string;
  sourceCount?: number;
}

/**
 * IntelAuditLogger
 *
 * Domain-specific audit logger for intel operations.
 */
export class IntelAuditLogger extends DomainAuditLogger<IntelAuditAction, IntelAuditEntry> {
  private static instance: IntelAuditLogger;

  private constructor() {
    super({
      category: AuditCategory.INTEL,
      domainLabel: 'Intel',
    });
  }

  static getInstance(): IntelAuditLogger {
    if (!IntelAuditLogger.instance) {
      IntelAuditLogger.instance = new IntelAuditLogger();
    }
    return IntelAuditLogger.instance;
  }

  static resetInstance(): void {
    if (process.env.NODE_ENV === 'test') {
      IntelAuditLogger.instance = undefined as unknown as IntelAuditLogger;
    }
  }

  protected buildMessage(entry: IntelAuditEntry): string {
    return `Intel ${entry.action}: ${entry.reportTitle}`;
  }

  protected buildResource(entry: IntelAuditEntry): string {
    return `intel/${entry.intelId}`;
  }

  logReportFiled(params: {
    organizationId: string;
    intelId: string;
    reportTitle: string;
    classificationLevel?: string;
    targetId?: string;
    performedById?: string;
    performedByName?: string;
  }): void {
    this.log({
      action: IntelAuditAction.INTEL_REPORT_FILED,
      intelId: params.intelId,
      reportTitle: params.reportTitle,
      classificationLevel: params.classificationLevel,
      targetId: params.targetId,
      organizationId: params.organizationId,
      performedById: params.performedById,
      performedByName: params.performedByName,
      details: {
        classificationLevel: params.classificationLevel,
        targetId: params.targetId,
      },
    });
  }

  logReportShared(params: {
    organizationId: string;
    intelId: string;
    reportTitle: string;
    sharedWith: string[];
    classificationLevel?: string;
    performedById?: string;
    performedByName?: string;
  }): void {
    this.log({
      action: IntelAuditAction.INTEL_REPORT_SHARED,
      intelId: params.intelId,
      reportTitle: params.reportTitle,
      classificationLevel: params.classificationLevel,
      organizationId: params.organizationId,
      performedById: params.performedById,
      performedByName: params.performedByName,
      details: {
        sharedWith: params.sharedWith,
        classificationLevel: params.classificationLevel,
      },
    });
  }
}

export const intelAuditLogger = IntelAuditLogger.getInstance();

