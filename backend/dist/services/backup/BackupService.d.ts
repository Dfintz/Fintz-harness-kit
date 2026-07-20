import { Backup, BackupStatus, BackupType } from '../../models/Backup';
import { BackupFrequency, BackupSchedule } from '../../models/BackupSchedule';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { TenantService } from '../base/TenantService';
export declare enum BackupAuditAction {
    BACKUP_CREATED = "backup_created",
    BACKUP_COMPLETED = "backup_completed",
    BACKUP_FAILED = "backup_failed",
    BACKUP_DELETED = "backup_deleted",
    BACKUP_RESTORED = "backup_restored",
    SCHEDULE_CONFIGURED = "schedule_configured"
}
export interface CreateBackupDTO {
    name?: string;
    description?: string;
    backupType?: BackupType;
}
export interface ConfigureScheduleDTO {
    frequency: BackupFrequency;
    retentionDays?: number;
    enabled?: boolean;
}
export interface BackupSearchFilters {
    status?: BackupStatus;
    backupType?: BackupType;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}
export declare class BackupService extends TenantService<Backup> {
    private readonly scheduleRepository;
    private readonly backupStorage;
    constructor();
    private logBackupAudit;
    createBackup(organizationId: string, creatorId: string, creatorName: string, dto: CreateBackupDTO): Promise<Backup>;
    private processBackup;
    private collectOrganizationData;
    getBackupById(organizationId: string, backupId: string): Promise<Backup | null>;
    listBackups(organizationId: string, filters: BackupSearchFilters, pagination: PaginationOptions): Promise<PaginatedResponse<Backup>>;
    getBackupStatus(organizationId: string): Promise<{
        latestBackup: Backup | null;
        totalBackups: number;
        schedule: BackupSchedule | null;
    }>;
    getDownloadUrl(organizationId: string, backupId: string): Promise<string | null>;
    deleteBackup(organizationId: string, backupId: string, userId: string, userName: string): Promise<void>;
    restoreFromBackup(organizationId: string, backupId: string, userId: string, userName: string): Promise<{
        message: string;
    }>;
    configureSchedule(organizationId: string, userId: string, userName: string, dto: ConfigureScheduleDTO): Promise<BackupSchedule>;
    getSchedule(organizationId: string): Promise<BackupSchedule | null>;
    cleanupExpiredBackups(): Promise<number>;
    private calculateNextRun;
}
//# sourceMappingURL=BackupService.d.ts.map