import type { BaseDomainAuditEntry } from '../shared/DomainAuditLogger';
import { DomainAuditLogger } from '../shared/DomainAuditLogger';
export declare enum OrgSettingsAuditAction {
    ORG_SETTINGS_UPDATED = "ORG_SETTINGS_UPDATED",
    ORG_SECURITY_POLICY_CHANGED = "ORG_SECURITY_POLICY_CHANGED",
    ORG_TIER_CHANGED = "ORG_TIER_CHANGED",
    ORG_TRUST_SCORE_ADJUSTED = "ORG_TRUST_SCORE_ADJUSTED",
    ORG_DEFAULT_SETTINGS_CHANGED = "ORG_DEFAULT_SETTINGS_CHANGED",
    ORG_FEDERATION_SETTINGS_CHANGED = "ORG_FEDERATION_SETTINGS_CHANGED",
    ORG_ARCHIVAL_POLICY_CHANGED = "ORG_ARCHIVAL_POLICY_CHANGED"
}
export interface OrgSettingsAuditEntry extends BaseDomainAuditEntry<OrgSettingsAuditAction> {
    organizationId: string;
    settingCategory?: 'security' | 'tier' | 'trust' | 'defaults' | 'federation' | 'archival';
    settingKey?: string;
    previousValue?: unknown;
    newValue?: unknown;
    reason?: string;
    impactedUsers?: number;
    details: Record<string, unknown>;
}
export declare class OrgSettingsAuditLogger extends DomainAuditLogger<OrgSettingsAuditAction, OrgSettingsAuditEntry> {
    private static instance;
    private constructor();
    static getInstance(): OrgSettingsAuditLogger;
    static resetInstance(): void;
    protected buildMessage(entry: OrgSettingsAuditEntry): string;
    protected buildResource(entry: OrgSettingsAuditEntry): string;
    logSettingsUpdated(organizationId: string, settingKey: string, previousValue: unknown, newValue: unknown, changedById: string, changedByName: string): void;
    logSecurityPolicyChanged(organizationId: string, policyName: string, reason: string, changedById: string, changedByName: string): void;
    logTierChanged(organizationId: string, previousTier: string, newTier: string, changedById: string, changedByName: string): void;
    logTrustScoreAdjusted(organizationId: string, previousScore: number, newScore: number, reason: string, adjustedById: string, adjustedByName: string): void;
    logDefaultSettingsChanged(organizationId: string, settingKey: string, newValue: unknown, changedById: string, changedByName: string): void;
    logFederationSettingsChanged(organizationId: string, reason: string, changedById: string, changedByName: string): void;
}
export declare const orgSettingsAuditLogger: OrgSettingsAuditLogger;
//# sourceMappingURL=OrgSettingsAuditLogger.d.ts.map