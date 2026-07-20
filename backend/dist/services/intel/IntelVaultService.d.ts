import { IntelAuditAction, IntelAuditLog } from '../../models/IntelAuditLog';
import { IntelCategory, IntelClassification, IntelEntry } from '../../models/IntelEntry';
import { IntelOfficer, IntelOfficerRank } from '../../models/IntelOfficer';
export interface CreateIntelEntryInput {
    organizationId: string;
    title: string;
    content: string;
    classification: IntelClassification;
    category: IntelCategory;
    tags?: string[];
    location?: string;
    eventDate?: Date;
    metadata?: Record<string, unknown>;
}
export interface UpdateIntelEntryInput {
    title?: string;
    content?: string;
    classification?: IntelClassification;
    category?: IntelCategory;
    tags?: string[];
    location?: string;
    eventDate?: Date;
    isArchived?: boolean;
    metadata?: Record<string, unknown>;
}
export interface IntelAccessCheck {
    hasAccess: boolean;
    reason?: string;
    accessLevel?: string;
    isOwner?: boolean;
    isIntelOfficer?: boolean;
    officerRank?: IntelOfficerRank;
}
export declare class IntelVaultService {
    private readonly intelEntryRepo;
    private readonly intelOfficerRepo;
    private readonly auditLogRepo;
    private readonly userOrgRepo;
    private readonly accessCache;
    private static readonly ACCESS_CACHE_TTL_MS;
    constructor();
    clearAccessCache(userId?: string, organizationId?: string): void;
    private resolveAccessFromMembership;
    checkAccess(userId: string, organizationId: string): Promise<IntelAccessCheck>;
    canAccessClassification(userId: string, organizationId: string, classification: IntelClassification): Promise<boolean>;
    private canAccessClassificationWithAccess;
    getHighestRankingOfficer(organizationId: string): Promise<IntelOfficer | null>;
    createEntry(input: CreateIntelEntryInput, createdBy: string, ipAddress?: string, userAgent?: string): Promise<IntelEntry>;
    getEntries(organizationId: string, userId: string, options?: {
        includeArchived?: boolean;
        classification?: IntelClassification;
        category?: IntelCategory;
        search?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        entries: IntelEntry[];
        total: number;
    }>;
    getEntry(entryId: string, userId: string, organizationId: string, ipAddress?: string, userAgent?: string): Promise<IntelEntry>;
    private validateEditAccess;
    private trackChanges;
    updateEntry(entryId: string, userId: string, organizationId: string, input: UpdateIntelEntryInput, ipAddress?: string, userAgent?: string): Promise<IntelEntry>;
    deleteEntry(entryId: string, userId: string, organizationId: string, ipAddress?: string, userAgent?: string): Promise<void>;
    private logAudit;
    getAuditLogs(organizationId: string, userId: string, options?: {
        intelEntryId?: string;
        action?: IntelAuditAction;
        userId?: string;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }): Promise<{
        logs: IntelAuditLog[];
        total: number;
    }>;
}
//# sourceMappingURL=IntelVaultService.d.ts.map