"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchmakingService = exports.MatchmakingService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const LFGUserReputation_1 = require("../../models/LFGUserReputation");
const UserGameplayPreferences_1 = require("../../models/UserGameplayPreferences");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const AvailabilityService_1 = require("../calendar/AvailabilityService");
const LFGSessionService_1 = require("./LFGSessionService");
class MatchmakingService {
    preferencesRepo;
    reputationRepo;
    lfgService;
    availabilityService;
    CACHE_TTL = 300;
    ANALYTICS_TTL = 30 * 24 * 60 * 60;
    MATCH_CACHE_PREFIX = 'matchmaking:recommendations:';
    ANALYTICS_PREFIX = 'matchmaking:analytics:';
    WEIGHTS = {
        ACTIVITY_PREFERENCE: 25,
        SKILL_MATCH: 20,
        PLAYSTYLE_MATCH: 15,
        REPUTATION: 15,
        TIMEZONE: 10,
        AVAILABILITY: 10,
        EXPERIENCE_MATCH: 5,
    };
    constructor(preferencesRepo, reputationRepo, lfgService, availabilityService) {
        this.preferencesRepo = preferencesRepo || data_source_1.AppDataSource.getRepository(UserGameplayPreferences_1.UserGameplayPreferences);
        this.reputationRepo = reputationRepo || data_source_1.AppDataSource.getRepository(LFGUserReputation_1.LFGUserReputation);
        this.lfgService = lfgService || LFGSessionService_1.lfgSessionService;
        this.availabilityService = availabilityService || new AvailabilityService_1.AvailabilityService();
    }
    async findMatches(userId, activityType, limit = 10) {
        try {
            const cached = await this.getCachedRecommendations(userId);
            if (cached) {
                logger_1.logger.debug('Returning cached matchmaking recommendations', { userId });
                return cached;
            }
            const [preferences, reputation] = await Promise.all([
                this.preferencesRepo.findOne({ where: { userId } }),
                this.reputationRepo.findOne({ where: { userId } }),
            ]);
            if (!preferences) {
                logger_1.logger.warn('User has no gameplay preferences set', { userId });
                const sessions = await this.lfgService.findOpenSessions({ activityType });
                return {
                    userId,
                    recommendations: sessions.slice(0, limit).map(session => ({
                        sessionId: session.id,
                        score: 50,
                        breakdown: {
                            activityMatch: 50,
                            skillMatch: 50,
                            preferenceMatch: 50,
                            reputationMatch: 50,
                            timezoneMatch: 50,
                            availabilityMatch: 50,
                        },
                        session,
                    })),
                    totalMatches: sessions.length,
                    generatedAt: new Date(),
                };
            }
            const sessions = await this.lfgService.findOpenSessions({ activityType });
            if (sessions.length === 0) {
                return {
                    userId,
                    recommendations: [],
                    totalMatches: 0,
                    generatedAt: new Date(),
                };
            }
            const hostUserIds = [...new Set(sessions.map(s => s.hostUserId))];
            const orgIds = [...new Set(sessions.map(s => s.organizationId))];
            const primaryOrgId = orgIds.length === 1 ? orgIds[0] : undefined;
            const [allHostPrefs, allHostReps] = await Promise.all([
                this.preferencesRepo.find({ where: { userId: (0, typeorm_1.In)(hostUserIds) } }),
                this.reputationRepo.find({ where: { userId: (0, typeorm_1.In)(hostUserIds) } }),
            ]);
            const hostPrefsMap = new Map(allHostPrefs.map(p => [p.userId, p]));
            const hostRepsMap = new Map(allHostReps.map(r => [r.userId, r]));
            let userAvailSlots = [];
            let hostAvailMap = new Map();
            if (primaryOrgId) {
                const allUserIds = [...new Set([userId, ...hostUserIds])];
                const availMap = await this.availabilityService.getAvailabilityForUsers(primaryOrgId, allUserIds);
                userAvailSlots = availMap.get(userId) || [];
                hostAvailMap = availMap;
            }
            const matches = await Promise.all(sessions.map(session => this.calculateMatchQuality(userId, session, preferences, reputation, hostPrefsMap.get(session.hostUserId) || null, hostRepsMap.get(session.hostUserId) || null, userAvailSlots, hostAvailMap.get(session.hostUserId) || [])));
            const goodMatches = matches.filter(m => m.score >= 30);
            goodMatches.sort((a, b) => b.score - a.score);
            const protectedMatches = this.applyReviewBombingProtection(goodMatches);
            const recommendations = protectedMatches.slice(0, limit);
            const result = {
                userId,
                recommendations,
                totalMatches: goodMatches.length,
                generatedAt: new Date(),
            };
            await this.cacheRecommendations(userId, result);
            logger_1.logger.info('Generated matchmaking recommendations', {
                userId,
                totalSessions: sessions.length,
                goodMatches: goodMatches.length,
                returned: recommendations.length,
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error finding matches', { userId, error });
            throw error;
        }
    }
    async calculateMatchQuality(userId, session, userPreferences, userReputation, hostPreferences = undefined, hostReputation = undefined, userAvailSlots = [], hostAvailSlots = []) {
        if (hostPreferences === undefined) {
            const [fetchedPrefs, fetchedRep] = await Promise.all([
                this.preferencesRepo.findOne({ where: { userId: session.hostUserId } }),
                this.reputationRepo.findOne({ where: { userId: session.hostUserId } }),
            ]);
            hostPreferences = fetchedPrefs;
            hostReputation = fetchedRep;
        }
        const resolvedHostPrefs = hostPreferences ?? null;
        const resolvedHostRep = hostReputation ?? null;
        const activityMatch = this.calculateActivityMatch(userPreferences, session.activityType);
        const skillMatch = this.calculateSkillMatch(userPreferences, resolvedHostPrefs, session.activityType);
        const preferenceMatch = this.calculatePreferenceMatch(userPreferences, resolvedHostPrefs);
        const reputationMatch = this.calculateReputationMatch(userReputation, resolvedHostRep, userPreferences);
        const timezoneMatch = this.calculateTimezoneMatch(userPreferences, resolvedHostPrefs);
        const availabilityMatch = this.calculateAvailabilityMatch(userPreferences, resolvedHostPrefs, userAvailSlots, hostAvailSlots);
        const score = Math.round((activityMatch * this.WEIGHTS.ACTIVITY_PREFERENCE) / 100 +
            (skillMatch * this.WEIGHTS.SKILL_MATCH) / 100 +
            (preferenceMatch * (this.WEIGHTS.PLAYSTYLE_MATCH + this.WEIGHTS.EXPERIENCE_MATCH)) / 100 +
            (reputationMatch * this.WEIGHTS.REPUTATION) / 100 +
            (timezoneMatch * this.WEIGHTS.TIMEZONE) / 100 +
            (availabilityMatch * this.WEIGHTS.AVAILABILITY) / 100);
        return {
            sessionId: session.id,
            score,
            breakdown: {
                activityMatch,
                skillMatch,
                preferenceMatch,
                reputationMatch,
                timezoneMatch,
                availabilityMatch,
            },
            session,
        };
    }
    calculateActivityMatch(preferences, activityType) {
        const preferenceWeight = preferences.getActivityPreference(activityType);
        if (preferenceWeight === 0) {
            return 50;
        }
        return preferenceWeight;
    }
    calculateSkillMatch(userPreferences, hostPreferences, activityType) {
        if (!hostPreferences) {
            return 50;
        }
        const skillMapping = {
            PvP: 'combatSkill',
            PvE: 'combatSkill',
            'Bounty Hunting': 'combatSkill',
            Mining: 'miningSkill',
            Trading: 'tradingSkill',
            'Cargo Hauling': 'tradingSkill',
            Exploration: 'pilotingSkill',
            Racing: 'pilotingSkill',
        };
        const skillAttr = skillMapping[activityType];
        if (!skillAttr) {
            return 50;
        }
        const userSkill = this.getEffectiveSkill(userPreferences, skillAttr);
        const hostSkill = this.getEffectiveSkill(hostPreferences, skillAttr);
        const difference = Math.abs(userSkill - hostSkill);
        const similarity = 100 - difference;
        if (difference <= 20) {
            return 100;
        }
        else if (difference <= 40) {
            return similarity;
        }
        else {
            return Math.max(20, similarity);
        }
    }
    getEffectiveSkill(prefs, skillAttr) {
        const rawSkill = prefs[skillAttr] || 0;
        if (prefs.scstatsVerified) {
            return rawSkill;
        }
        return rawSkill * 0.7;
    }
    calculatePreferenceMatch(userPreferences, hostPreferences) {
        if (!hostPreferences) {
            return 50;
        }
        let matchPoints = 0;
        let totalChecks = 0;
        const commonPlaystyles = userPreferences.playstyles.filter(style => hostPreferences.playstyles.includes(style));
        matchPoints += (commonPlaystyles.length / Math.max(userPreferences.playstyles.length, 1)) * 30;
        totalChecks += 30;
        if (userPreferences.requiresVoiceChat === hostPreferences.requiresVoiceChat) {
            matchPoints += 20;
        }
        totalChecks += 20;
        const userMidSize = (userPreferences.preferredGroupSizeMin + userPreferences.preferredGroupSizeMax) / 2;
        const hostMidSize = (hostPreferences.preferredGroupSizeMin + hostPreferences.preferredGroupSizeMax) / 2;
        const sizeDiff = Math.abs(userMidSize - hostMidSize);
        if (sizeDiff <= 2) {
            matchPoints += 20;
        }
        else if (sizeDiff <= 4) {
            matchPoints += 10;
        }
        totalChecks += 20;
        const commonLanguages = userPreferences.languages.filter(lang => hostPreferences.languages.includes(lang));
        if (commonLanguages.length > 0) {
            matchPoints += 30;
        }
        totalChecks += 30;
        return Math.round((matchPoints / totalChecks) * 100);
    }
    calculateReputationMatch(userReputation, hostReputation, userPreferences) {
        if (!hostReputation) {
            return 50;
        }
        if (hostReputation.overallScore < userPreferences.minReputationScore) {
            return 0;
        }
        const isHostSuspicious = this.detectSuspiciousReputation(hostReputation);
        if (isHostSuspicious) {
            return Math.min(hostReputation.overallScore * 0.7, 70);
        }
        if (hostReputation.totalRatingsReceived >= 10) {
            return Math.min(hostReputation.overallScore + 10, 100);
        }
        return hostReputation.overallScore;
    }
    detectSuspiciousReputation(reputation) {
        if (reputation.totalRatingsReceived < 5) {
            return false;
        }
        const positiveRatio = reputation.positiveRatings / reputation.totalRatingsReceived;
        const negativeRatio = reputation.negativeRatings / reputation.totalRatingsReceived;
        if (positiveRatio > 0.95 || negativeRatio > 0.95) {
            return true;
        }
        if (reputation.successRate > 80 && reputation.averageRating < 3.0) {
            return true;
        }
        if (reputation.averageRating > 4.5 && reputation.successRate < 40) {
            return true;
        }
        return false;
    }
    calculateTimezoneMatch(userPreferences, hostPreferences) {
        if (!userPreferences.timezone || !hostPreferences?.timezone) {
            return 100;
        }
        return userPreferences.timezone === hostPreferences.timezone ? 100 : 50;
    }
    calculateAvailabilityMatch(userPreferences, hostPreferences, userAvailSlots = [], hostAvailSlots = []) {
        if (userAvailSlots.length > 0 && hostAvailSlots.length > 0) {
            return this.calculateRealAvailabilityOverlap(userAvailSlots, hostAvailSlots);
        }
        if (!userPreferences.availability || !hostPreferences?.availability) {
            return 100;
        }
        const commonSlots = userPreferences.availability.filter(slot => hostPreferences.availability?.includes(slot));
        if (commonSlots.length === 0) {
            return 20;
        }
        const overlapRatio = commonSlots.length /
            Math.max(userPreferences.availability.length, hostPreferences.availability.length);
        return Math.round(overlapRatio * 100);
    }
    calculateRealAvailabilityOverlap(userSlots, hostSlots) {
        let totalUserMinutes = 0;
        let overlapMinutes = 0;
        for (const userSlot of userSlots) {
            const duration = userSlot.endMinute - userSlot.startMinute;
            totalUserMinutes += duration;
            for (const hostSlot of hostSlots) {
                if (hostSlot.dayOfWeek !== userSlot.dayOfWeek) {
                    continue;
                }
                const overlapStart = Math.max(userSlot.startMinute, hostSlot.startMinute);
                const overlapEnd = Math.min(userSlot.endMinute, hostSlot.endMinute);
                if (overlapEnd > overlapStart) {
                    overlapMinutes += overlapEnd - overlapStart;
                }
            }
        }
        if (totalUserMinutes === 0) {
            return 100;
        }
        const ratio = Math.min(overlapMinutes / totalUserMinutes, 1);
        return Math.max(Math.round(ratio * 100), 10);
    }
    applyReviewBombingProtection(matches) {
        return matches.map(match => match);
    }
    async trackMatchAnalytics(userId, sessionId, matchScore, joined) {
        try {
            const analytics = {
                userId,
                sessionId,
                matchScore,
                joined,
                timestamp: new Date(),
            };
            const key = `${this.ANALYTICS_PREFIX}${userId}:${sessionId}`;
            await redis_1.redisClient.set(key, analytics, this.ANALYTICS_TTL);
            logger_1.logger.debug('Tracked matchmaking analytics', analytics);
        }
        catch (error) {
            logger_1.logger.error('Error tracking matchmaking analytics', { error });
        }
    }
    async getCachedRecommendations(userId) {
        try {
            const cached = await redis_1.redisClient.get(`${this.MATCH_CACHE_PREFIX}${userId}`);
            return cached;
        }
        catch (error) {
            logger_1.logger.error('Error getting cached recommendations', { error });
            return null;
        }
    }
    async cacheRecommendations(userId, recommendations) {
        try {
            await redis_1.redisClient.set(`${this.MATCH_CACHE_PREFIX}${userId}`, recommendations, this.CACHE_TTL);
        }
        catch (error) {
            logger_1.logger.error('Error caching recommendations', { error });
        }
    }
    async clearCache(userId) {
        try {
            await redis_1.redisClient.del(`${this.MATCH_CACHE_PREFIX}${userId}`);
            logger_1.logger.debug('Cleared matchmaking cache', { userId });
        }
        catch (error) {
            logger_1.logger.error('Error clearing matchmaking cache', { error });
        }
    }
    async getAnalytics(userId, days = 7) {
        try {
            const keys = await redis_1.redisClient.keys(`${this.ANALYTICS_PREFIX}${userId}:*`);
            if (!keys || keys.length === 0) {
                return [];
            }
            const analytics = [];
            const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            for (const key of keys) {
                const data = await redis_1.redisClient.get(key);
                if (data && new Date(data.timestamp) >= cutoffDate) {
                    analytics.push(data);
                }
            }
            return analytics;
        }
        catch (error) {
            logger_1.logger.error('Error getting matchmaking analytics', { error });
            return [];
        }
    }
}
exports.MatchmakingService = MatchmakingService;
exports.matchmakingService = new MatchmakingService();
//# sourceMappingURL=MatchmakingService.js.map