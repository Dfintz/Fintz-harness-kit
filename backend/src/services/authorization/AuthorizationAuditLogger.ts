import { AuditCategory } from '../audit/AuditService';
import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';

/**
 * Authorization audit event types for comprehensive logging.
 * Tracks authorization decisions and permission-related operations.
 */
export enum AuthorizationAuditAction {
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  ROLE_REVOKED = 'ROLE_REVOKED',
  AUTHORIZATION_CHECK_FAILED = 'AUTHORIZATION_CHECK_FAILED',
  PERMISSION_POLICY_UPDATED = 'PERMISSION_POLICY_UPDATED',
  SCOPE_EXPANDED = 'SCOPE_EXPANDED',
  SCOPE_RESTRICTED = 'SCOPE_RESTRICTED',
}

/**
 * Authorization audit log entry interface
 */
export interface AuthorizationAuditEntry extends BaseDomainAuditEntry<AuthorizationAuditAction> {
  authorizationId: string;
  subjectId: string;
  subjectType: string;
  resourceType: string;
  permission: string;
}

/**
 * AuthorizationAuditLogger
 *
 * Domain-specific audit logger for authorization operations.
 */
export class AuthorizationAuditLogger extends DomainAuditLogger<
  AuthorizationAuditAction,
  AuthorizationAuditEntry
> {
  private static instance: AuthorizationAuditLogger;

  private constructor() {
    super({
      category: AuditCategory.AUTHORIZATION,
      domainLabel: 'Authorization',
    });
  }

  static getInstance(): AuthorizationAuditLogger {
    if (!AuthorizationAuditLogger.instance) {
      AuthorizationAuditLogger.instance = new AuthorizationAuditLogger();
    }
    return AuthorizationAuditLogger.instance;
  }

  static resetInstance(): void {
    if (process.env.NODE_ENV === 'test') {
      AuthorizationAuditLogger.instance = undefined as unknown as AuthorizationAuditLogger;
    }
  }

  protected buildMessage(entry: AuthorizationAuditEntry): string {
    return `Authorization ${entry.action}: ${entry.subjectType} ${entry.subjectId} on ${entry.resourceType}/${entry.permission}`;
  }

  protected buildResource(entry: AuthorizationAuditEntry): string {
    return `authorization/${entry.authorizationId}`;
  }

  logPermissionGranted(params: {
    organizationId: string;
    authorizationId: string;
    subjectId: string;
    subjectType: string;
    resourceType: string;
    permission: string;
    performedById?: string;
    performedByName?: string;
  }): void {
    this.log({
      action: AuthorizationAuditAction.PERMISSION_GRANTED,
      authorizationId: params.authorizationId,
      subjectId: params.subjectId,
      subjectType: params.subjectType,
      resourceType: params.resourceType,
      permission: params.permission,
      organizationId: params.organizationId,
      performedById: params.performedById,
      performedByName: params.performedByName,
      details: {
        subjectType: params.subjectType,
        resourceType: params.resourceType,
        permission: params.permission,
      },
    });
  }

  logPermissionRevoked(params: {
    organizationId: string;
    authorizationId: string;
    subjectId: string;
    subjectType: string;
    resourceType: string;
    permission: string;
    performedById?: string;
    performedByName?: string;
  }): void {
    this.log({
      action: AuthorizationAuditAction.PERMISSION_REVOKED,
      authorizationId: params.authorizationId,
      subjectId: params.subjectId,
      subjectType: params.subjectType,
      resourceType: params.resourceType,
      permission: params.permission,
      organizationId: params.organizationId,
      performedById: params.performedById,
      performedByName: params.performedByName,
      details: {
        subjectType: params.subjectType,
        resourceType: params.resourceType,
        permission: params.permission,
      },
    });
  }
}

export const authorizationAuditLogger = AuthorizationAuditLogger.getInstance();

