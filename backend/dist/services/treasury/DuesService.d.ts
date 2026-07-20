import { DuesFrequency, OrgDues } from '../../models/OrgDues';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { TenantService } from '../base/TenantService';
export interface CreateDuesDTO {
    name: string;
    amount: number;
    frequency: DuesFrequency;
    dueDay?: number;
    gracePeriodDays?: number;
}
export interface UpdateDuesDTO {
    name?: string;
    amount?: number;
    frequency?: DuesFrequency;
    isActive?: boolean;
    dueDay?: number;
    gracePeriodDays?: number;
}
export interface UtcCalendarSnapshot {
    dayOfMonth: number;
    dayOfWeek: number;
    month: number;
    year: number;
    daysInMonth: number;
    collectionDateUtc: string;
}
export declare class DuesService extends TenantService<OrgDues> {
    private readonly treasuryService;
    constructor();
    createDues(organizationId: string, creatorId: string, dto: CreateDuesDTO): Promise<OrgDues>;
    getDuesById(organizationId: string, duesId: string): Promise<OrgDues | null>;
    listDues(organizationId: string, pagination: PaginationOptions, activeOnly?: boolean): Promise<PaginatedResponse<OrgDues>>;
    updateDues(organizationId: string, duesId: string, dto: UpdateDuesDTO): Promise<OrgDues>;
    deleteDues(organizationId: string, duesId: string): Promise<void>;
    collectDueIfEligible(dues: OrgDues, collectionDateUtc: string): Promise<boolean>;
    private acquireCollectionRun;
    private markCollectionRunCompleted;
    private markCollectionRunFailed;
    private getCollectionIdempotencyKey;
    getUtcCalendarSnapshot(now?: Date): UtcCalendarSnapshot;
    isDueToday(dues: OrgDues, utcSnapshot: UtcCalendarSnapshot): boolean;
}
//# sourceMappingURL=DuesService.d.ts.map