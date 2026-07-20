import { Repository } from 'typeorm';
import { LFGUserReputation } from '../../models/LFGUserReputation';
import { UserGameplayPreferences } from '../../models/UserGameplayPreferences';
import { AvailabilityService } from '../calendar/AvailabilityService';
import { LFGSession, LFGSessionService } from './LFGSessionService';
export interface MatchQuality {
    sessionId: string;
    score: number;
    breakdown: {
        activityMatch: number;
        skillMatch: number;
        preferenceMatch: number;
        reputationMatch: number;
        timezoneMatch: number;
        availabilityMatch: number;
    };
    session: LFGSession;
}
export interface MatchmakingRecommendation {
    userId: string;
    recommendations: MatchQuality[];
    totalMatches: number;
    generatedAt: Date;
}
export interface MatchmakingAnalytics {
    userId: string;
    sessionId: string;
    matchScore: number;
    joined: boolean;
    timestamp: Date;
}
export declare class MatchmakingService {
    private readonly preferencesRepo;
    private readonly reputationRepo;
    private readonly lfgService;
    private readonly availabilityService;
    private readonly CACHE_TTL;
    private readonly ANALYTICS_TTL;
    private readonly MATCH_CACHE_PREFIX;
    private readonly ANALYTICS_PREFIX;
    private readonly WEIGHTS;
    constructor(preferencesRepo?: Repository<UserGameplayPreferences>, reputationRepo?: Repository<LFGUserReputation>, lfgService?: LFGSessionService, availabilityService?: AvailabilityService);
    findMatches(userId: string, activityType?: string, limit?: number): Promise<MatchmakingRecommendation>;
    private calculateMatchQuality;
    private calculateActivityMatch;
    private calculateSkillMatch;
    private getEffectiveSkill;
    private calculatePreferenceMatch;
    private calculateReputationMatch;
    private detectSuspiciousReputation;
    private calculateTimezoneMatch;
    private calculateAvailabilityMatch;
    private calculateRealAvailabilityOverlap;
    private applyReviewBombingProtection;
    trackMatchAnalytics(userId: string, sessionId: string, matchScore: number, joined: boolean): Promise<void>;
    private getCachedRecommendations;
    private cacheRecommendations;
    clearCache(userId: string): Promise<void>;
    getAnalytics(userId: string, days?: number): Promise<MatchmakingAnalytics[]>;
}
export declare const matchmakingService: MatchmakingService;
//# sourceMappingURL=MatchmakingService.d.ts.map