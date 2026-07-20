import { IntelClassification, IntelEntry } from '../../models/IntelEntry';
export interface ScheduleDeclassificationInput {
    intelEntryId: string;
    organizationId: string;
    declassificationDate: Date;
    targetClassification: IntelClassification;
    autoDeclassify: boolean;
    reason?: string;
}
export interface ScheduleReviewInput {
    intelEntryId: string;
    organizationId: string;
    reviewDate: Date;
    reviewIntervalDays?: number;
}
export interface AgingReviewResult {
    entryId: string;
    title: string;
    currentClassification: IntelClassification;
    reviewDate: Date;
    daysPastDue: number;
    lastReviewedAt?: Date;
    recommendation: 'maintain' | 'declassify' | 'archive' | 'delete';
}
export interface DeclassificationResult {
    entryId: string;
    title: string;
    previousClassification: IntelClassification;
    newClassification: IntelClassification;
    declassifiedAt: Date;
    success: boolean;
    error?: string;
}
export declare class IntelAgingService {
    private readonly intelEntryRepo;
    private readonly intelOfficerRepo;
    private readonly auditLogRepo;
    private readonly userOrgRepo;
    private readonly classificationOrder;
    private readonly defaultReviewIntervals;
    private static readonly TACTICAL_STALENESS_DAYS;
    private static readonly HIGH_CLASSIFICATION_DECLASSIFY_DAYS;
    private static readonly OLD_INTEL_ARCHIVE_DAYS;
    constructor();
    canManageAging(userId: string, organizationId: string): Promise<boolean>;
    scheduleDeclassification(input: ScheduleDeclassificationInput, userId: string, ipAddress?: string, userAgent?: string): Promise<IntelEntry>;
    cancelDeclassification(intelEntryId: string, organizationId: string, userId: string, reason?: string, ipAddress?: string, userAgent?: string): Promise<IntelEntry>;
    executeDeclassification(intelEntryId: string, organizationId: string, targetClassification: IntelClassification, userId: string, reason?: string, ipAddress?: string, userAgent?: string): Promise<IntelEntry>;
    scheduleReview(input: ScheduleReviewInput, userId: string, ipAddress?: string, userAgent?: string): Promise<IntelEntry>;
    completeReview(intelEntryId: string, organizationId: string, userId: string, notes?: string, scheduleNextReview?: boolean, ipAddress?: string, userAgent?: string): Promise<IntelEntry>;
    setExpiration(intelEntryId: string, organizationId: string, expirationDate: Date, userId: string, ipAddress?: string, userAgent?: string): Promise<IntelEntry>;
    getEntriesDueForReview(organizationId: string, userId: string, options?: {
        includeOverdue?: boolean;
        daysAhead?: number;
        limit?: number;
        offset?: number;
    }): Promise<{
        entries: AgingReviewResult[];
        total: number;
    }>;
    getEntriesPendingDeclassification(organizationId: string, userId: string, options?: {
        includeOverdue?: boolean;
        daysAhead?: number;
        limit?: number;
        offset?: number;
    }): Promise<{
        entries: IntelEntry[];
        total: number;
    }>;
    processAutoDeclassifications(): Promise<DeclassificationResult[]>;
    processExpiredEntries(): Promise<number>;
    getAgingStatistics(organizationId: string, userId: string): Promise<{
        totalEntries: number;
        pendingReviews: number;
        overdueReviews: number;
        pendingDeclassifications: number;
        expiringSoon: number;
        byClassification: Record<IntelClassification, number>;
    }>;
    private getReviewRecommendation;
    private logAudit;
}
//# sourceMappingURL=IntelAgingService.d.ts.map