import { Organization } from './Organization';
import { User } from './User';
export declare enum IntelAccessLevel {
    READ = "read",
    WRITE = "write",
    EDIT = "edit",
    DELETE = "delete",
    ADMIN = "admin"
}
export declare enum IntelClassification {
    PUBLIC = "public",
    RESTRICTED = "restricted",
    CONFIDENTIAL = "confidential",
    SECRET = "secret",
    TOP_SECRET = "top_secret"
}
export declare enum IntelCategory {
    STRATEGIC = "strategic",
    TACTICAL = "tactical",
    PERSONNEL = "personnel",
    ENEMY = "enemy",
    ALLIANCE = "alliance",
    ECONOMIC = "economic",
    TECHNICAL = "technical",
    OTHER = "other"
}
export declare class IntelEntry {
    id: string;
    organizationId: string;
    organization?: Organization;
    title: string;
    content: string;
    classification: IntelClassification;
    category: IntelCategory;
    tags?: string[];
    location?: string;
    eventDate?: Date;
    isArchived: boolean;
    createdBy: string;
    creator?: User;
    updatedBy?: string;
    updater?: User;
    createdAt: Date;
    updatedAt: Date;
    declassificationDate?: Date;
    targetClassification?: IntelClassification;
    reviewDate?: Date;
    reviewIntervalDays?: number;
    lastReviewedAt?: Date;
    lastReviewedBy?: string;
    autoDeclassify: boolean;
    expirationDate?: Date;
    isExpired: boolean;
    isShared: boolean;
    shareCount: number;
    metadata?: {
        attachments?: string[];
        relatedEntries?: string[];
        sources?: string[];
        reliability?: number;
        urgency?: 'low' | 'medium' | 'high' | 'critical';
        expirationDate?: Date;
        customFields?: Record<string, unknown>;
        agingHistory?: {
            date: Date;
            action: string;
            fromClassification?: IntelClassification;
            toClassification?: IntelClassification;
            performedBy?: string;
            reason?: string;
        }[];
        shareHistory?: {
            date: Date;
            action: string;
            targetOrgId?: string;
            performedBy?: string;
        }[];
    };
}
//# sourceMappingURL=IntelEntry.d.ts.map