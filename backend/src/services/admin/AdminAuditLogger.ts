import { AuditCategory } from '../audit/AuditService';
import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';

/**
 * Admin audit event types for comprehensive logging.
 * Tracks administrative operations and configuration changes.
 */
export enum AdminAuditAction {
  ADMIN_CREATED = 'ADMIN_CREATED',
  ADMIN_REMOVED = 'ADMIN_REMOVED',
  ADMIN_PERMISSION_CHANGED = 'ADMIN_PERMISSION_CHANGED',
  ADMIN_ROLE_ASSIGNED = 'ADMIN_ROLE_ASSIGNED',
  ADMIN_ROLE_REVOKED = 'ADMIN_ROLE_REVOKED',
  SYSTEM_CONFIG_UPDATED = 'SYSTEM_CONFIG_UPDATED',
  SECURITY_POLICY_UPDATED = 'SECURITY_POLICY_UPDATED',
  AUDIT_SETTINGS_CHANGED = 'AUDIT_SETTINGS_CHANGED',
}

/**
 * Admin audit log entry interface
 */
export interface AdminAuditEntry extends BaseDomainAuditEntry<AdminAuditAction> {
  adminId: string;
  adminEmail?: string;
  targetId?: string;
  configSection?: string;
}

/**
 * AdminAuditLogger
 *
 * Domain-specific audit logger for admin operations.
 */
export class AdminAuditLogger extends DomainAuditLogger<AdminAuditAction, AdminAuditEntry> {
  private static instance: AdminAuditLogger;

  private constructor() {
    super({
      category: AuditCategory.ADMIN,
      domainLabel: 'Admin',
    });
  }

  static getInstance(): AdminAuditLogger {
    if (!AdminAuditLogger.instance) {
      AdminAuditLogger.instance = new AdminAuditLogger();
    }
    return AdminAuditLogger.instance;
  }

  static resetInstance(): void {
    if (process.env.NODE_ENV === 'test') {
      AdminAuditLogger.instance = undefined as unknown as AdminAuditLogger;
    }
  }

  protected buildMessage(entry: AdminAuditEntry): string {
    return `Admin ${entry.action}: ${entry.adminEmail || entry.adminId}`;
  }

  protected buildResource(entry: AdminAuditEntry): string {
    return `admin/${entry.adminId}`;
  }

  logPermissionChanged(params: {
    organizationId: string;
    adminId: string;
    adminEmail?: string;
    targetId: string;
    permissionType: string;
    granted: boolean;
    performedById?: string;
    performedByName?: string;
  }): void {
    this.log({
      action: AdminAuditAction.ADMIN_PERMISSION_CHANGED,
      adminId: params.adminId,
      adminEmail: params.adminEmail,
      targetId: params.targetId,
      organizationId: params.organizationId,
      performedById: params.performedById,
      performedByName: params.performedByName,
      details: {
        targetId: params.targetId,
        permissionType: params.permissionType,
        granted: params.granted,
      },
    });
  }
}

export const adminAuditLogger = AdminAuditLogger.getInstance();

