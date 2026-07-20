export declare enum ChangeType {
    CREATED = "created",
    TYPE_CHANGED = "type_changed",
    STATUS_CHANGED = "status_changed",
    TRUST_UPDATED = "trust_updated",
    STRENGTH_UPDATED = "strength_updated",
    INTERACTION_RECORDED = "interaction_recorded",
    METADATA_UPDATED = "metadata_updated",
    NOTES_UPDATED = "notes_updated",
    CONTACT_UPDATED = "contact_updated",
    REVIEW_SCHEDULED = "review_scheduled",
    EXPIRED = "expired",
    RENEWED = "renewed",
    SUSPENDED = "suspended",
    REACTIVATED = "reactivated",
    TERMINATED = "terminated",
    MUTUAL_ESTABLISHED = "mutual_established",
    MUTUAL_BROKEN = "mutual_broken",
    CUSTOM = "custom"
}
export declare enum InteractionSentiment {
    VERY_POSITIVE = "very_positive",
    POSITIVE = "positive",
    NEUTRAL = "neutral",
    NEGATIVE = "negative",
    VERY_NEGATIVE = "very_negative"
}
export declare class RelationshipHistory {
    id: string;
    relationshipId: string;
    organizationId: string;
    targetOrganizationId: string;
    changeType: ChangeType;
    description: string;
    previousValue?: unknown;
    newValue?: unknown;
    changeDetails?: {
        trustScoreDelta?: number;
        strengthDelta?: number;
        interactionType?: string;
        sentiment?: InteractionSentiment;
        impact?: 'high' | 'medium' | 'low';
        automated?: boolean;
        customData?: Record<string, unknown>;
    };
    actorId?: string;
    actorName?: string;
    actorRole?: string;
    reason?: string;
    notes?: string;
    tags?: string[];
    metadata?: {
        ipAddress?: string;
        userAgent?: string;
        location?: string;
        source?: string;
        relatedEventId?: string;
        relatedActivityId?: string;
        customFields?: Record<string, unknown>;
    };
    isSystemGenerated: boolean;
    isSignificant: boolean;
    requiresNotification: boolean;
    notificationSent: boolean;
    createdAt: Date;
    getSentimentScore(): number;
    isPositiveChange(): boolean;
    isNegativeChange(): boolean;
    getImpactLevel(): 'high' | 'medium' | 'low';
    getChangeSummary(): string;
    getDetailedSummary(): Record<string, unknown>;
}
//# sourceMappingURL=RelationshipHistory.d.ts.map