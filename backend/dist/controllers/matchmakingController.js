"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchmakingController = exports.MatchmakingController = void 0;
const data_source_1 = require("../data-source");
const UserGameplayPreferences_1 = require("../models/UserGameplayPreferences");
const MatchmakingService_1 = require("../services/social/MatchmakingService");
const logger_1 = require("../utils/logger");
class MatchmakingController {
    get preferencesRepo() {
        return data_source_1.AppDataSource.getRepository(UserGameplayPreferences_1.UserGameplayPreferences);
    }
    async getPreferences(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const preferences = await this.preferencesRepo.findOne({ where: { userId } });
            if (!preferences) {
                res.status(404).json({ error: 'Preferences not found. Please set your preferences first.' });
                return;
            }
            res.json({
                preferences,
                summary: preferences.getSummary()
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting preferences', { error });
            res.status(500).json({ error: 'Failed to get preferences' });
        }
    }
    async setPreferences(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const { activityPreferences, experienceLevels, playstyles, preferredGroupSizeMin, preferredGroupSizeMax, requiresVoiceChat, prefersSilentPlay, timezone, availability, preferredRoles, languages, combatSkill, pilotingSkill, tradingSkill, miningSkill, allowCrossOrgMatching, onlyMatchWithVerified, minReputationScore } = req.body;
            if (!activityPreferences || typeof activityPreferences !== 'object') {
                res.status(400).json({ error: 'Activity preferences are required' });
                return;
            }
            if (!playstyles || !Array.isArray(playstyles) || playstyles.length === 0) {
                res.status(400).json({ error: 'At least one playstyle is required' });
                return;
            }
            let preferences = await this.preferencesRepo.findOne({ where: { userId } });
            if (preferences) {
                if (!preferences.canUpdatePreferences()) {
                    res.status(429).json({
                        error: 'You can only update preferences once per hour',
                        nextUpdateAllowed: new Date(preferences.lastPreferenceUpdate.getTime() + 60 * 60 * 1000)
                    });
                    return;
                }
                preferences.activityPreferences = activityPreferences;
                preferences.experienceLevels = experienceLevels || preferences.experienceLevels;
                preferences.playstyles = playstyles;
                preferences.preferredGroupSizeMin = preferredGroupSizeMin ?? preferences.preferredGroupSizeMin;
                preferences.preferredGroupSizeMax = preferredGroupSizeMax ?? preferences.preferredGroupSizeMax;
                preferences.requiresVoiceChat = requiresVoiceChat ?? preferences.requiresVoiceChat;
                preferences.prefersSilentPlay = prefersSilentPlay ?? preferences.prefersSilentPlay;
                preferences.timezone = timezone ?? preferences.timezone;
                preferences.availability = availability ?? preferences.availability;
                preferences.preferredRoles = preferredRoles ?? preferences.preferredRoles;
                preferences.languages = languages ?? preferences.languages;
                preferences.combatSkill = combatSkill ?? preferences.combatSkill;
                preferences.pilotingSkill = pilotingSkill ?? preferences.pilotingSkill;
                preferences.tradingSkill = tradingSkill ?? preferences.tradingSkill;
                preferences.miningSkill = miningSkill ?? preferences.miningSkill;
                preferences.allowCrossOrgMatching = allowCrossOrgMatching ?? preferences.allowCrossOrgMatching;
                preferences.onlyMatchWithVerified = onlyMatchWithVerified ?? preferences.onlyMatchWithVerified;
                preferences.minReputationScore = minReputationScore ?? preferences.minReputationScore;
                preferences.recordUpdate();
            }
            else {
                preferences = this.preferencesRepo.create({
                    userId,
                    activityPreferences,
                    experienceLevels: experienceLevels || {},
                    playstyles,
                    preferredGroupSizeMin: preferredGroupSizeMin ?? 4,
                    preferredGroupSizeMax: preferredGroupSizeMax ?? 8,
                    requiresVoiceChat: requiresVoiceChat ?? false,
                    prefersSilentPlay: prefersSilentPlay ?? false,
                    timezone,
                    availability: availability || [],
                    preferredRoles: preferredRoles || [],
                    languages: languages || ['english'],
                    combatSkill: combatSkill ?? 50,
                    pilotingSkill: pilotingSkill ?? 50,
                    tradingSkill: tradingSkill ?? 50,
                    miningSkill: miningSkill ?? 50,
                    allowCrossOrgMatching: allowCrossOrgMatching ?? true,
                    onlyMatchWithVerified: onlyMatchWithVerified ?? false,
                    minReputationScore: minReputationScore ?? 50
                });
                preferences.recordUpdate();
            }
            await this.preferencesRepo.save(preferences);
            await MatchmakingService_1.matchmakingService.clearCache(userId);
            logger_1.logger.info('User preferences updated', {
                userId,
                updateCount: preferences.preferenceUpdateCount
            });
            res.json({
                message: 'Preferences updated successfully',
                preferences,
                summary: preferences.getSummary()
            });
        }
        catch (error) {
            logger_1.logger.error('Error setting preferences', { error });
            res.status(500).json({ error: 'Failed to set preferences' });
        }
    }
    async findMatches(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const { activityType, limit } = req.query;
            const recommendations = await MatchmakingService_1.matchmakingService.findMatches(userId, activityType, Math.min(limit ? parseInt(limit, 10) : 10, 200));
            res.json(recommendations);
        }
        catch (error) {
            logger_1.logger.error('Error finding matches', { error });
            res.status(500).json({ error: 'Failed to find matches' });
        }
    }
    async trackJoin(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const { sessionId, matchScore } = req.body;
            if (!sessionId) {
                res.status(400).json({ error: 'Session ID is required' });
                return;
            }
            await MatchmakingService_1.matchmakingService.trackMatchAnalytics(userId, sessionId, matchScore || 0, true);
            res.json({ message: 'Join tracked successfully' });
        }
        catch (error) {
            logger_1.logger.error('Error tracking join', { error });
            res.status(500).json({ error: 'Failed to track join' });
        }
    }
    async getAnalytics(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const { days } = req.query;
            const analytics = await MatchmakingService_1.matchmakingService.getAnalytics(userId, days ? parseInt(days, 10) : 7);
            const summary = {
                totalMatches: analytics.length,
                joinedCount: analytics.filter(a => a.joined).length,
                averageMatchScore: analytics.length > 0
                    ? analytics.reduce((sum, a) => sum + a.matchScore, 0) / analytics.length
                    : 0,
                joinRate: analytics.length > 0
                    ? (analytics.filter(a => a.joined).length / analytics.length) * 100
                    : 0
            };
            res.json({
                summary,
                analytics
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting analytics', { error });
            res.status(500).json({ error: 'Failed to get analytics' });
        }
    }
    async getEnums(req, res) {
        try {
            res.json({
                playstyles: Object.values(UserGameplayPreferences_1.Playstyle),
                experienceLevels: Object.values(UserGameplayPreferences_1.ExperienceLevel),
                availability: Object.values(UserGameplayPreferences_1.Availability)
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting enums', { error });
            res.status(500).json({ error: 'Failed to get enums' });
        }
    }
}
exports.MatchmakingController = MatchmakingController;
let _matchmakingController = null;
exports.matchmakingController = new Proxy({}, {
    get(target, prop) {
        if (!_matchmakingController) {
            _matchmakingController = new MatchmakingController();
        }
        return _matchmakingController[prop];
    }
});
//# sourceMappingURL=matchmakingController.js.map