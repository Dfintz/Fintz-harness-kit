import { RsiSyncSchedule } from '../../models/RsiSyncSchedule';
export interface SyncScheduleInput {
    organizationId: string;
    rsiOrgSid: string;
    guildId?: string;
    isEnabled?: boolean;
    intervalMinutes?: number;
    notifyOnChanges?: boolean;
    notifyOnErrors?: boolean;
    notificationChannelId?: string;
    removeRolesOnLeave?: boolean;
    affiliateHandling?: 'include' | 'exclude' | 'special_role';
    affiliateRoleId?: string;
    maxConsecutiveFailures?: number;
}
export declare class RsiSyncScheduleService {
    private scheduleRepository;
    constructor();
    upsertSchedule(input: SyncScheduleInput): Promise<RsiSyncSchedule>;
    getSchedule(organizationId: string): Promise<RsiSyncSchedule | null>;
    getScheduleById(id: string): Promise<RsiSyncSchedule | null>;
    deleteSchedule(organizationId: string): Promise<boolean>;
    getSchedulesDueForSync(): Promise<RsiSyncSchedule[]>;
    getEnabledSchedules(): Promise<RsiSyncSchedule[]>;
    getAutoDisabledSchedules(): Promise<RsiSyncSchedule[]>;
    enableSchedule(organizationId: string): Promise<RsiSyncSchedule | null>;
    disableSchedule(organizationId: string): Promise<RsiSyncSchedule | null>;
    markSyncSuccess(organizationId: string): Promise<void>;
    markSyncFailed(organizationId: string, errorMessage: string): Promise<{
        autoDisabled: boolean;
    }>;
    resetFailures(organizationId: string): Promise<void>;
    getScheduleStatus(organizationId: string): Promise<{
        exists: boolean;
        enabled: boolean;
        isDue: boolean;
        lastSync: Date | null;
        nextSync: Date | null;
        failures: number;
        autoDisabled: boolean;
        interval: string;
        rsiOrgSid: string | null;
    }>;
    updateInterval(organizationId: string, intervalMinutes: number): Promise<RsiSyncSchedule | null>;
    getAllSchedules(): Promise<RsiSyncSchedule[]>;
}
export declare const rsiSyncScheduleService: RsiSyncScheduleService;
//# sourceMappingURL=RsiSyncScheduleService.d.ts.map