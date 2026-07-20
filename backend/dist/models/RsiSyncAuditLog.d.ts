import { Organization } from './Organization';
export declare enum SyncType {
    MANUAL = "manual",
    SCHEDULED = "scheduled",
    WEBHOOK = "webhook"
}
export interface SyncChangeDetails {
    rolesAdded?: Array<{
        userId: string;
        discordUserId?: string;
        rsiHandle: string;
        roleId: string;
        roleName?: string;
    }>;
    rolesRemoved?: Array<{
        userId: string;
        discordUserId?: string;
        rsiHandle: string;
        roleId: string;
        roleName?: string;
    }>;
    rankChanges?: Array<{
        userId: string;
        rsiHandle: string;
        previousRank: string;
        newRank: string;
    }>;
    removedMembers?: Array<{
        userId: string;
        rsiHandle: string;
        lastKnownRank?: string;
    }>;
    conflicts?: Array<{
        type: string;
        userId?: string;
        rsiHandle?: string;
        description: string;
        resolution: string;
    }>;
    errors?: Array<{
        userId?: string;
        rsiHandle?: string;
        error: string;
    }>;
    triggeredBy?: string;
    rsiOrgSid?: string;
    guildId?: string;
    durationMs?: number;
    memberSnapshot?: {
        total: number;
        main: number;
        affiliate: number;
        hidden: number;
        redacted: number;
    };
    delta?: {
        newMembers: Array<{
            handle: string;
            rank?: string;
            isAffiliate: boolean;
        }>;
        removedMembers: Array<{
            handle: string;
            lastRank?: string;
        }>;
        rankChanges: Array<{
            handle: string;
            oldRank: string;
            newRank: string;
        }>;
        statusChanges: Array<{
            handle: string;
            field: string;
            oldValue: string;
            newValue: string;
        }>;
    };
}
export declare class RsiSyncAuditLog {
    id: string;
    organizationId: string;
    organization: Organization;
    syncType: SyncType;
    changesDetected: number;
    changesApplied: number;
    errors: number;
    details?: SyncChangeDetails;
    syncedAt: Date;
    hasErrors(): boolean;
    hasChanges(): boolean;
    wasFullySuccessful(): boolean;
    getSuccessRate(): number;
    getSummary(): string;
    getRoleChangeCount(): number;
    getRankChangeCount(): number;
    getRemovedMemberCount(): number;
    getConflictCount(): number;
    getDurationSeconds(): number | null;
}
//# sourceMappingURL=RsiSyncAuditLog.d.ts.map