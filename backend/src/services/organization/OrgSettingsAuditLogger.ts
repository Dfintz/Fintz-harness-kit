/**
 * Organization Settings Audit Logger
 * Tracks organization-level configuration changes, security policies, and settings updates
 * Extends DomainAuditLogger for consistent audit trail pattern
 *
 * COMPLIANCE: GDPR (Configuration audit), SOX (Governance changes), ZT (Settings validation)
 */

import { AuditCategory } from '../audit/AuditService';
import type { BaseDomainAuditEntry } from '../shared/DomainAuditLogger';
import { DomainAuditLogger } from '../shared/DomainAuditLogger';

/**
 * Organization Settings audit action types
 * Tracks all org-level configuration changes
 */
export enum OrgSettingsAuditAction {
  ORG_SETTINGS_UPDATED = 'ORG_SETTINGS_UPDATED',
  ORG_SECURITY_POLICY_CHANGED = 'ORG_SECURITY_POLICY_CHANGED',
  ORG_TIER_CHANGED = 'ORG_TIER_CHANGED',
  ORG_TRUST_SCORE_ADJUSTED = 'ORG_TRUST_SCORE_ADJUSTED',
  ORG_DEFAULT_SETTINGS_CHANGED = 'ORG_DEFAULT_SETTINGS_CHANGED',
  ORG_FEDERATION_SETTINGS_CHANGED = 'ORG_FEDERATION_SETTINGS_CHANGED',
  ORG_ARCHIVAL_POLICY_CHANGED = 'ORG_ARCHIVAL_POLICY_CHANGED',
}

/**
 * Organization Settings audit log entry structure
 * Captures organization configuration changes
 */
export interface OrgSettingsAuditEntry extends BaseDomainAuditEntry<OrgSettingsAuditAction> {
  // Organization identifier
  organizationId: string;

  // Settings category
  settingCategory?: 'security' | 'tier' | 'trust' | 'defaults' | 'federation' | 'archival';

  // Modified fields
  settingKey?: string;
  previousValue?: unknown;
  newValue?: unknown;

  // Change context
  reason?: string;
  impactedUsers?: number;

  // Additional context
  details: Record<string, unknown>;
}

/**
 * Organization Settings Audit Logger Singleton
 * Provides typed audit logging for all org settings operations
 *
 * USAGE:
 *   const logger = OrgSettingsAuditLogger.getInstance();
 *   logger.logSettingsUpdated(...);
 *   logger.logSecurityPolicyChanged(...);
 */
export class OrgSettingsAuditLogger extends DomainAuditLogger<
  OrgSettingsAuditAction,
  OrgSettingsAuditEntry
> {
  private static instance: OrgSettingsAuditLogger;

  private constructor() {
    super({
      category: AuditCategory.ORGANIZATION,
      domainLabel: 'OrgSettings',
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): OrgSettingsAuditLogger {
    if (!OrgSettingsAuditLogger.instance) {
      OrgSettingsAuditLogger.instance = new OrgSettingsAuditLogger();
    }
    return OrgSettingsAuditLogger.instance;
  }

  static resetInstance(): void {
    if (process.env.NODE_ENV === 'test') {
      OrgSettingsAuditLogger.instance = undefined as unknown as OrgSettingsAuditLogger;
    }
  }

  /**
   * Build human-readable audit message
   */
  protected buildMessage(entry: OrgSettingsAuditEntry): string {
    switch (entry.action) {
      case OrgSettingsAuditAction.ORG_SETTINGS_UPDATED:
        return `Org settings updated: ${entry.settingKey} [${entry.previousValue} → ${entry.newValue}]`;
      case OrgSettingsAuditAction.ORG_SECURITY_POLICY_CHANGED:
        return `Org security policy changed: ${entry.reason || 'policy update'}`;
      case OrgSettingsAuditAction.ORG_TIER_CHANGED:
        return `Org tier changed: ${entry.previousValue} → ${entry.newValue}`;
      case OrgSettingsAuditAction.ORG_TRUST_SCORE_ADJUSTED:
        return `Org trust score adjusted: ${entry.previousValue} → ${entry.newValue}`;
      case OrgSettingsAuditAction.ORG_DEFAULT_SETTINGS_CHANGED:
        return `Org default settings changed: ${entry.settingKey}`;
      case OrgSettingsAuditAction.ORG_FEDERATION_SETTINGS_CHANGED:
        return `Org federation settings changed: ${entry.reason || 'federation update'}`;
      case OrgSettingsAuditAction.ORG_ARCHIVAL_POLICY_CHANGED:
        return `Org archival policy changed: ${entry.reason || 'archival update'}`;
      default:
        return `Org settings operation: ${entry.action}`;
    }
  }

  /**
   * Build audit resource identifier
   */
  protected buildResource(entry: OrgSettingsAuditEntry): string {
    return `org/${entry.organizationId}/settings`;
  }

  // ============ Convenience Methods ============

  /**
   * Log organization settings update
   */
  logSettingsUpdated(
    organizationId: string,
    settingKey: string,
    previousValue: unknown,
    newValue: unknown,
    changedById: string,
    changedByName: string
  ): void {
    this.log({
      action: OrgSettingsAuditAction.ORG_SETTINGS_UPDATED,
      organizationId,
      settingCategory: 'defaults',
      settingKey,
      previousValue,
      newValue,
      performedById: changedById,
      performedByName: changedByName,
      details: { changedBy: changedById },
    });
  }

  /**
   * Log security policy change
   */
  logSecurityPolicyChanged(
    organizationId: string,
    policyName: string,
    reason: string,
    changedById: string,
    changedByName: string
  ): void {
    this.log({
      action: OrgSettingsAuditAction.ORG_SECURITY_POLICY_CHANGED,
      organizationId,
      settingCategory: 'security',
      settingKey: policyName,
      reason,
      performedById: changedById,
      performedByName: changedByName,
      details: { policy: policyName },
    });
  }

  /**
   * Log organization tier change
   */
  logTierChanged(
    organizationId: string,
    previousTier: string,
    newTier: string,
    changedById: string,
    changedByName: string
  ): void {
    this.log({
      action: OrgSettingsAuditAction.ORG_TIER_CHANGED,
      organizationId,
      settingCategory: 'tier',
      previousValue: previousTier,
      newValue: newTier,
      performedById: changedById,
      performedByName: changedByName,
      details: {},
    });
  }

  /**
   * Log trust score adjustment
   */
  logTrustScoreAdjusted(
    organizationId: string,
    previousScore: number,
    newScore: number,
    reason: string,
    adjustedById: string,
    adjustedByName: string
  ): void {
    this.log({
      action: OrgSettingsAuditAction.ORG_TRUST_SCORE_ADJUSTED,
      organizationId,
      settingCategory: 'trust',
      previousValue: previousScore,
      newValue: newScore,
      reason,
      performedById: adjustedById,
      performedByName: adjustedByName,
      details: { reason },
    });
  }

  /**
   * Log default settings change
   */
  logDefaultSettingsChanged(
    organizationId: string,
    settingKey: string,
    newValue: unknown,
    changedById: string,
    changedByName: string
  ): void {
    this.log({
      action: OrgSettingsAuditAction.ORG_DEFAULT_SETTINGS_CHANGED,
      organizationId,
      settingCategory: 'defaults',
      settingKey,
      newValue,
      performedById: changedById,
      performedByName: changedByName,
      details: { setting: settingKey },
    });
  }

  /**
   * Log federation settings change
   */
  logFederationSettingsChanged(
    organizationId: string,
    reason: string,
    changedById: string,
    changedByName: string
  ): void {
    this.log({
      action: OrgSettingsAuditAction.ORG_FEDERATION_SETTINGS_CHANGED,
      organizationId,
      settingCategory: 'federation',
      reason,
      performedById: changedById,
      performedByName: changedByName,
      details: { reason },
    });
  }
}

/**
 * Export singleton instance
 */
export const orgSettingsAuditLogger = OrgSettingsAuditLogger.getInstance();
