import type { OrganizationRelationshipSummary } from '../types/models';
export declare enum RelationshipType {
    ALLIED = "allied",
    PARTNERSHIP = "partnership",
    COOPERATIVE = "cooperative",
    AFFILIATED = "affiliated",
    TRADING_PARTNER = "trading_partner",
    NEUTRAL = "neutral",
    OBSERVER = "observer",
    INTERESTED = "interested",
    COMPETITIVE = "competitive",
    RIVAL = "rival",
    HOSTILE = "hostile",
    WAR = "war",
    PARENT = "parent",
    SUBSIDIARY = "subsidiary",
    MERGER_PENDING = "merger_pending",
    UNDER_NEGOTIATION = "under_negotiation"
}
export declare enum RelationshipStatus {
    ACTIVE = "active",
    PENDING = "pending",
    SUSPENDED = "suspended",
    TERMINATED = "terminated",
    EXPIRED = "expired"
}
export declare class OrganizationRelationship {
    id: string;
    organizationId: string;
    targetOrganizationId: string;
    type: RelationshipType;
    status: RelationshipStatus;
    trustScore: number;
    relationshipStrength: number;
    interactionCount: number;
    positiveInteractions: number;
    negativeInteractions: number;
    description?: string;
    notes?: string;
    tags?: string[];
    metadata?: {
        tradeVolume?: number;
        sharedEvents?: number;
        cooperativeOperations?: number;
        conflicts?: number;
        treaties?: string[];
        agreements?: string[];
        customFields?: Record<string, unknown>;
    };
    primaryContact?: string;
    contactName?: string;
    contactRole?: string;
    contactEmail?: string;
    communicationChannels?: string[];
    establishedBy?: string;
    lastModifiedBy?: string;
    establishedDate?: Date;
    lastInteractionDate?: Date;
    reviewDate?: Date;
    expiryDate?: Date;
    isMutual: boolean;
    isMutuallyRecognized: boolean;
    reciprocalRelationshipId?: string;
    isPublic: boolean;
    requiresApproval: boolean;
    autoRenew: boolean;
    createdAt: Date;
    updatedAt: Date;
    calculateHealthScore(): number;
    getRelationshipTier(): 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    needsReview(): boolean;
    isExpired(): boolean;
    getTrustLevel(): string;
    getStrengthLevel(): string;
    getSummary(): OrganizationRelationshipSummary;
}
//# sourceMappingURL=OrganizationRelationship.d.ts.map