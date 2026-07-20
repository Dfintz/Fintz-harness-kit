import { Repository } from 'typeorm';
import { LFGReputationRating, ReputationCategory } from '../../models/LFGReputationRating';
import { LFGUserReputation } from '../../models/LFGUserReputation';
import { OrganizationRelationship } from '../../models/OrganizationRelationship';
import { InteractionSentiment } from '../../models/RelationshipHistory';
import { ReputationCategory as GeneralReputationCategory, Reputation } from '../../models/Reputation';
export interface CreateRatingParams {
    sessionId: string;
    userId: string;
    raterId: string;
    overallRating: number;
    categoryRatings?: {
        [key in ReputationCategory]?: number;
    };
    comment?: string;
}
export interface ReputationLeaderboard {
    userId: string;
    overallScore: number;
    tier: string;
    totalSessions: number;
    successRate: number;
    averageRating: number;
}
export interface UnifiedReputationScore {
    userId: string;
    userReputation: {
        overallScore: number;
        tier: string;
        totalSessions: number;
        successRate: number;
        averageRating: number;
    };
    organizationTrust?: {
        organizationId: string;
        trustScore: number;
        trustLevel: string;
        interactionCount: number;
        sentiment: string;
    }[];
    combinedScore: number;
    reliability: string;
}
export interface ReputationTrend {
    date: Date;
    userScore: number;
    trustScore?: number;
    combinedScore: number;
    significantEvents: string[];
}
export interface ReputationReport {
    unifiedScore: UnifiedReputationScore;
    recentActivity: {
        lfgSessions: number;
        organizationInteractions: number;
        positiveEvents: number;
        negativeEvents: number;
    };
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    trend: 'improving' | 'stable' | 'declining';
}
export declare class ReputationService {
    private readonly ratingRepository;
    private readonly userReputationRepository;
    private readonly relationshipRepository;
    private readonly generalReputationRepository;
    private readonly socialGroupService;
    constructor(ratingRepository?: Repository<LFGReputationRating>, reputationRepository?: Repository<LFGUserReputation>, relationshipRepository?: Repository<OrganizationRelationship>);
    getUnifiedReputation(userId: string, organizationId?: string): Promise<UnifiedReputationScore>;
    getReputationReport(userId: string, organizationId?: string): Promise<ReputationReport>;
    private getReputationTrendAnalysis;
    private analyzeReputationFactors;
    private analyzeOrgTrust;
    compareReputations(userId1: string, userId2: string, organizationId?: string): Promise<{
        user1: UnifiedReputationScore;
        user2: UnifiedReputationScore;
        comparison: {
            scoreDifference: number;
            betterUser: string;
            categories: {
                category: string;
                user1Score: number;
                user2Score: number;
                winner: string;
            }[];
        };
    }>;
    recordReputationEvent(params: {
        type: 'lfg_rating' | 'org_interaction';
        userId?: string;
        organizationId?: string;
        targetOrganizationId?: string;
        relationshipId?: string;
        sentiment?: InteractionSentiment;
        rating?: number;
        description: string;
        metadata?: Record<string, unknown>;
    }): Promise<void>;
    getGlobalLeaderboard(limit?: number, organizationId?: string): Promise<Array<{
        userId: string;
        combinedScore: number;
        reliability: string;
        userScore: number;
        trustScore?: number;
    }>>;
    submitRating(params: CreateRatingParams): Promise<LFGReputationRating>;
    getUserReputation(userId: string): Promise<LFGUserReputation>;
    updateUserReputation(userId: string): Promise<LFGUserReputation>;
    getUserRatings(userId: string, limit?: number): Promise<LFGReputationRating[]>;
    getRatingsGivenByUser(raterId: string, limit?: number): Promise<LFGReputationRating[]>;
    getSessionRatings(sessionId: string): Promise<LFGReputationRating[]>;
    hasUserRatedSession(sessionId: string, userId: string, raterId: string): Promise<boolean>;
    getReputationLeaderboard(limit?: number, minSessions?: number): Promise<ReputationLeaderboard[]>;
    getCategoryLeaderboard(category: ReputationCategory, limit?: number): Promise<Array<{
        userId: string;
        categoryAverage: number;
        totalSessions: number;
        overallScore: number;
    }>>;
    getPendingRatings(userId: string): Promise<Array<{
        sessionId: string;
        activity: string;
        completedAt: Date;
        participants: string[];
    }>>;
    batchUpdateReputations(userIds: string[]): Promise<void>;
    getDetailedReputation(userId: string): Promise<{
        reputation: LFGUserReputation;
        recentRatings: LFGReputationRating[];
        categoryBreakdown: {
            [key: string]: number;
        };
        topActivities: Array<{
            activity: string;
            sessions: number;
            averageRating: number;
        }>;
    }>;
    cleanupOldRatings(daysOld?: number): Promise<number>;
    private getOverallSentiment;
    private getRecentInteractionCount;
    invalidateUserReputation(userId: string): Promise<void>;
    invalidateOrganizationCache(userId: string, organizationId: string): Promise<void>;
    invalidateAllOrganizationCache(organizationId: string): Promise<void>;
    refreshUserReputation(userId: string, organizationId?: string): Promise<UnifiedReputationScore>;
    getCacheStats(userId: string, organizationId?: string): Promise<{
        exists: boolean;
        ttl: number;
        key: string;
    }>;
    getOrCreateReputation(userId: string): Promise<Reputation>;
    updateScore(userId: string, category: GeneralReputationCategory, amount: number, reason: string, modifiedBy: string): Promise<Reputation>;
    getLeaderboard(pagination: {
        page?: number;
        limit?: number;
    }, category?: string): Promise<{
        data: Reputation[];
        total: number;
    }>;
}
//# sourceMappingURL=ReputationService.d.ts.map