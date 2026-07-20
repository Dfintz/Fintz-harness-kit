export declare enum OrganizationType {
    ROOT = "root",
    DIVISION = "division",
    DEPARTMENT = "department",
    TEAM = "team",
    PROJECT = "project"
}
export declare enum OrganizationStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
    ARCHIVED = "archived",
    SUSPENDED = "suspended"
}
export interface IPWhitelistSettings {
    enabled: boolean;
    allowedIPs?: string[];
    blockedIPs?: string[];
    bypassForAdmins?: boolean;
    auditFailures?: boolean;
}
export interface GdprSettings {
    deletionGracePeriodDays?: number;
    exportLinkExpirationDays?: number;
}
export declare const DEFAULT_GDPR_SETTINGS: {
    readonly deletionGracePeriodDays: 30;
    readonly exportLinkExpirationDays: 7;
};
export declare const MIN_EXPORT_EXPIRATION_DAYS = 1;
export declare const MAX_EXPORT_EXPIRATION_DAYS = 90;
export { MAX_GRACE_PERIOD_DAYS, MIN_GRACE_PERIOD_DAYS } from '../config/gdpr';
import type { ApplicationQuestion, VoiceServerConfig } from '@sc-fleet-manager/shared-types';
export interface OrganizationSettings {
    visibility?: 'public' | 'private' | 'restricted';
    allowSubOrgs?: boolean;
    maxDepth?: number;
    requireApproval?: boolean;
    inheritPermissions?: boolean;
    enableTeams?: boolean;
    enableTitlesBadges?: boolean;
    uexStoreHandle?: string;
    starComms?: {
        enableBriefingSync?: boolean;
        enableTeamSync?: boolean;
    };
    customFields?: Record<string, unknown>;
    ipWhitelist?: IPWhitelistSettings;
    gdpr?: GdprSettings;
    applicationQuestions?: ApplicationQuestion[];
    voiceServer?: VoiceServerConfig;
}
export declare class Organization {
    id: string;
    name: string;
    description?: string;
    members?: string[];
    parentOrgId?: string;
    parent?: Organization;
    children: Organization[];
    type: OrganizationType;
    level: number;
    path: string;
    rootOrgId?: string;
    status: OrganizationStatus;
    ownerId?: string;
    adminIds?: string[];
    settings?: OrganizationSettings;
    metadata?: Record<string, unknown>;
    structure?: unknown;
    tags?: string[];
    logoUrl?: string;
    website?: string;
    contactEmail?: string;
    totalMembers: number;
    directMembers: number;
    childCount: number;
    rsiSid?: string;
    rsiVerified: boolean;
    rsiVerifiedAt?: Date;
    rsiVerificationCode?: string;
    rsiVerificationCodeExpiresAt?: Date;
    isArchived: boolean;
    archivedAt?: Date;
    archivedBy?: string;
    archiveReason?: string;
    restoredAt?: Date;
    restoredBy?: string;
    createdAt: Date;
    updatedAt: Date;
    isRoot(): boolean;
    isLeaf(): boolean;
    getAncestorIds(): string[];
    isAncestorOf(orgId: string): boolean;
    isDescendantOf(orgId: string): boolean;
    getPathArray(): string[];
    buildPath(parentPath?: string): string;
    getGdprSettings(): Required<GdprSettings>;
}
//# sourceMappingURL=Organization.d.ts.map