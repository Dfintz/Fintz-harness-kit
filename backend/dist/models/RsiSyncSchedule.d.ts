import { Organization } from './Organization';
export declare class RsiSyncSchedule {
    id: string;
    organizationId: string;
    organization: Organization;
    rsiOrgSid: string;
    guildId?: string;
    isEnabled: boolean;
    intervalMinutes: number;
    lastSyncAt?: Date;
    nextSyncAt?: Date;
    consecutiveFailures: number;
    lastErrorMessage?: string;
    notifyOnChanges: boolean;
    notifyOnErrors: boolean;
    notificationChannelId?: string;
    removeRolesOnLeave: boolean;
    affiliateHandling: string;
    affiliateRoleId?: string;
    maxConsecutiveFailures: number;
    createdAt: Date;
    updatedAt: Date;
    isDueForSync(): boolean;
    calculateNextSyncTime(): Date;
    markSyncSuccess(): void;
    markSyncFailed(errorMessage: string): void;
    isAutoDisabled(): boolean;
    reEnable(): void;
    getStatus(): {
        enabled: boolean;
        isDue: boolean;
        lastSync: Date | null;
        nextSync: Date | null;
        failures: number;
        autoDisabled: boolean;
    };
    static readonly VALID_INTERVALS: readonly [360, 720, 1440];
    static validateInterval(minutes: number): boolean;
    getIntervalDisplay(): string;
}
//# sourceMappingURL=RsiSyncSchedule.d.ts.map