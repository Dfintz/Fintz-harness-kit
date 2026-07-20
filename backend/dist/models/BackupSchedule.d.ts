import { TenantEntity } from './base/TenantEntity';
export declare enum BackupFrequency {
    DAILY = "daily",
    WEEKLY = "weekly",
    MONTHLY = "monthly"
}
export declare class BackupSchedule extends TenantEntity {
    id: string;
    frequency: BackupFrequency;
    retentionDays: number;
    enabled: boolean;
    createdBy: string;
    lastRunAt?: Date;
    nextRunAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=BackupSchedule.d.ts.map