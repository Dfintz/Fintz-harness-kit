import { TenantEntity } from './base/TenantEntity';
export declare enum DuesFrequency {
    WEEKLY = "weekly",
    BIWEEKLY = "biweekly",
    MONTHLY = "monthly",
    QUARTERLY = "quarterly"
}
export declare class OrgDues extends TenantEntity {
    id: string;
    name: string;
    amount: number;
    frequency: DuesFrequency;
    isActive: boolean;
    dueDay: number;
    gracePeriodDays: number;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=OrgDues.d.ts.map