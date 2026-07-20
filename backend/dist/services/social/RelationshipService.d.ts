import { Repository } from 'typeorm';
import { OrganizationRelationship, RelationshipStatus, RelationshipType } from '../../models/OrganizationRelationship';
import { ChangeType, InteractionSentiment, RelationshipHistory } from '../../models/RelationshipHistory';
interface CreateRelationshipParams {
    organizationId: string;
    targetOrganizationId: string;
    type: RelationshipType;
    status?: RelationshipStatus;
    description?: string;
    notes?: string;
    tags?: string[];
    contactName?: string;
    contactRole?: string;
    contactEmail?: string;
    establishedById?: string;
    establishedByName?: string;
    metadata?: Record<string, unknown>;
}
interface UpdateRelationshipParams {
    type?: RelationshipType;
    status?: RelationshipStatus;
    description?: string;
    notes?: string;
    tags?: string[];
    contactName?: string;
    contactRole?: string;
    contactEmail?: string;
    communicationChannels?: string[];
    reviewDate?: string | null;
    expiryDate?: string | null;
    isPublic?: boolean;
    autoRenew?: boolean;
    metadata?: Record<string, unknown>;
}
interface RecordInteractionParams {
    relationshipId: string;
    organizationId?: string;
    sentiment: InteractionSentiment;
    description: string;
    actorId?: string;
    actorName?: string;
    metadata?: Record<string, unknown>;
}
interface CreateHistoryParams {
    relationshipId: string;
    organizationId: string;
    targetOrganizationId: string;
    changeType: ChangeType;
    description: string;
    previousValue?: unknown;
    newValue?: unknown;
    changeDetails?: Record<string, unknown>;
    actorId?: string;
    actorName?: string;
    actorRole?: string;
    reason?: string;
    notes?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
    isSystemGenerated?: boolean;
    isSignificant?: boolean;
    requiresNotification?: boolean;
}
interface HistoryQueryParams {
    changeTypes?: ChangeType[];
    actorId?: string;
    startDate?: Date;
    endDate?: Date;
    isSignificant?: boolean;
    onlyPositive?: boolean;
    onlyNegative?: boolean;
    limit?: number;
    offset?: number;
}
interface HistoryAnalytics {
    totalChanges: number;
    positiveChanges: number;
    negativeChanges: number;
    neutralChanges: number;
    averageSentiment: number;
    changesByType: Record<string, number>;
    recentTrend: 'improving' | 'declining' | 'stable';
    significantChanges: number;
    mostActiveActor?: {
        id: string;
        name: string;
        changeCount: number;
    };
}
interface TrustAdjustment {
    reason: string;
    delta: number;
    sentiment?: InteractionSentiment;
    metadata?: Record<string, unknown>;
}
interface TrustRecommendation {
    currentLevel: string;
    suggestedActions: string[];
    riskFactors: string[];
    opportunities: string[];
    nextReviewDate: Date;
}
export declare class RelationshipService {
    private readonly relationshipRepository;
    private readonly historyRepository;
    private readonly TRUST_WEIGHTS;
    private readonly TYPE_BONUSES;
    constructor(relationshipRepository?: Repository<OrganizationRelationship>, historyRepository?: Repository<RelationshipHistory>);
    calculateTrustScore(params: {
        currentTrust: number;
        relationshipType: RelationshipType;
        interactionHistory: {
            positive: number;
            negative: number;
            total: number;
        };
        durationDays: number;
        recentActivity: number;
    }): number;
    createRelationship(params: CreateRelationshipParams): Promise<OrganizationRelationship>;
    private applyRelationshipUpdates;
    private applyContactUpdates;
    private applyAgreementUpdates;
    updateRelationship(relationshipId: string, params: UpdateRelationshipParams, actorId?: string, actorName?: string, organizationId?: string): Promise<OrganizationRelationship>;
    recordInteraction(params: RecordInteractionParams): Promise<OrganizationRelationship>;
    establishMutualRelationship(relationshipId: string, actorId?: string, actorName?: string): Promise<void>;
    getRelationshipById(relationshipId: string, organizationId?: string): Promise<OrganizationRelationship | null>;
    getOrganizationRelationships(organizationId: string, filters?: {
        type?: RelationshipType[];
        status?: RelationshipStatus[];
        minTrust?: number;
        maxTrust?: number;
    }): Promise<OrganizationRelationship[]>;
    getRelationshipsNeedingReview(organizationId: string): Promise<OrganizationRelationship[]>;
    getRelationshipHealthSummary(organizationId: string): Promise<Record<string, unknown>>;
    terminateRelationship(relationshipId: string, reason: string, actorId?: string, actorName?: string, organizationId?: string): Promise<void>;
    private calculateStrengthDelta;
    createHistoryEntry(params: CreateHistoryParams): Promise<RelationshipHistory>;
    getRelationshipHistory(relationshipId: string, params?: HistoryQueryParams): Promise<RelationshipHistory[]>;
    getOrganizationHistory(organizationId: string, params?: HistoryQueryParams): Promise<RelationshipHistory[]>;
    getRelationshipTimeline(relationshipId: string): Promise<Array<{
        date: Date;
        type: string;
        summary: string;
        impact: string;
        sentiment: number;
        actor: string;
        details: string;
    }>>;
    private accumulateHistoryStats;
    private findMostActiveActor;
    analyzeRelationshipHistory(relationshipId: string, days?: number): Promise<HistoryAnalytics>;
    getSentimentTrend(relationshipId: string, days?: number, interval?: 'day' | 'week' | 'month'): Promise<Array<{
        period: string;
        sentiment: number;
        changeCount: number;
    }>>;
    getRecentSignificantChanges(organizationId: string, limit?: number): Promise<RelationshipHistory[]>;
    getPendingNotifications(organizationId: string): Promise<RelationshipHistory[]>;
    markNotificationSent(historyId: string): Promise<void>;
    getChangesByActor(actorId: string, params?: {
        limit?: number;
    }): Promise<RelationshipHistory[]>;
    private getPeriodKey;
    private getWeekNumber;
    updateTrustScore(relationship: OrganizationRelationship, adjustment: TrustAdjustment, actorId?: string, actorName?: string): Promise<number>;
    getTrustTrend(relationshipId: string, days?: number): Promise<Array<{
        date: Date;
        trust: number;
        change: number;
    }>>;
    getTrustRecommendations(relationship: OrganizationRelationship): TrustRecommendation;
    applyTrustDecay(relationship: OrganizationRelationship): Promise<void>;
    applyDecayToAll(organizationId: string): Promise<number>;
    private getSentimentTrustDelta;
    getOrganizationRelationshipsEnriched(organizationId: string, filters?: {
        type?: RelationshipType[];
        status?: RelationshipStatus[];
        minTrust?: number;
        maxTrust?: number;
    }): Promise<Array<OrganizationRelationship & {
        targetOrganization: {
            id: string;
            name: string;
            logoUrl?: string;
        } | null;
    }>>;
}
export {};
//# sourceMappingURL=RelationshipService.d.ts.map