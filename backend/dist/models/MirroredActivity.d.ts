import { TenantEntity } from './base/TenantEntity';
export declare enum MirroredActivityStatus {
    ACTIVE = "active",
    PAUSED = "paused",
    CANCELLED = "cancelled",
    EXPIRED = "expired"
}
export declare class MirroredActivity extends TenantEntity {
    id: string;
    sourceActivityId: string;
    sourceGuildId: string;
    sourceOrganizationId: string;
    mirrorActivityId?: string;
    mirrorGuildId: string;
    mirrorChannelId: string;
    mirrorMessageId?: string;
    mirrorKey?: string;
    status: MirroredActivityStatus;
    syncEnabled: boolean;
    lastSyncAt?: Date;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
    isActive(): boolean;
    canSync(): boolean;
}
//# sourceMappingURL=MirroredActivity.d.ts.map