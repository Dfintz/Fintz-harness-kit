import { Response } from 'express';

import { AppDataSource } from '../data-source';
import { AuthRequest } from '../middleware/auth';
import { UserGameplayPreferences, Playstyle, ExperienceLevel, Availability } from '../models/UserGameplayPreferences';
import { matchmakingService } from '../services/social/MatchmakingService';
import { logger } from '../utils/logger';

/**
 * Matchmaking Controller
 * 
 * Handles API endpoints for:
 * - Setting and updating gameplay preferences
 * - Finding matches
 * - Getting recommendations
 * - Analytics
 */
export class MatchmakingController {
    // Lazy initialization to avoid EntityMetadataNotFoundError before DB initialization
    private get preferencesRepo() {
        return AppDataSource.getRepository(UserGameplayPreferences);
    }

    /**
     * GET /api/matchmaking/preferences
     * Get current user's gameplay preferences
     */
    async getPreferences(req: AuthRequest, res: Response): Promise<void> {
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
        } catch (error) {
            logger.error('Error getting preferences', { error });
            res.status(500).json({ error: 'Failed to get preferences' });
        }
    }

    /**
     * POST /api/matchmaking/preferences
     * Set or update gameplay preferences
     */
    async setPreferences(req: AuthRequest, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            // Validate request body
            const {
                activityPreferences,
                experienceLevels,
                playstyles,
                preferredGroupSizeMin,
                preferredGroupSizeMax,
                requiresVoiceChat,
                prefersSilentPlay,
                timezone,
                availability,
                preferredRoles,
                languages,
                combatSkill,
                pilotingSkill,
                tradingSkill,
                miningSkill,
                allowCrossOrgMatching,
                onlyMatchWithVerified,
                minReputationScore
            } = req.body;

            // Validate activity preferences
            if (!activityPreferences || typeof activityPreferences !== 'object') {
                res.status(400).json({ error: 'Activity preferences are required' });
                return;
            }

            // Validate playstyles
            if (!playstyles || !Array.isArray(playstyles) || playstyles.length === 0) {
                res.status(400).json({ error: 'At least one playstyle is required' });
                return;
            }

            // Check for existing preferences
            let preferences = await this.preferencesRepo.findOne({ where: { userId } });

            if (preferences) {
                // Check rate limiting
                if (!preferences.canUpdatePreferences()) {
                    res.status(429).json({
                        error: 'You can only update preferences once per hour',
                        nextUpdateAllowed: new Date(
                            preferences.lastPreferenceUpdate!.getTime() + 60 * 60 * 1000
                        )
                    });
                    return;
                }

                // Update existing preferences
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
            } else {
                // Create new preferences
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

            // Save to database
            await this.preferencesRepo.save(preferences);

            // Clear cached matchmaking recommendations
            await matchmakingService.clearCache(userId);

            logger.info('User preferences updated', {
                userId,
                updateCount: preferences.preferenceUpdateCount
            });

            res.json({
                message: 'Preferences updated successfully',
                preferences,
                summary: preferences.getSummary()
            });
        } catch (error) {
            logger.error('Error setting preferences', { error });
            res.status(500).json({ error: 'Failed to set preferences' });
        }
    }

    /**
     * GET /api/matchmaking/find
     * Find matching sessions for the current user
     */
    async findMatches(req: AuthRequest, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const { activityType, limit } = req.query;

            const recommendations = await matchmakingService.findMatches(
                userId,
                activityType as string | undefined,
                Math.min(limit ? parseInt(limit as string, 10) : 10, 200)
            );

            res.json(recommendations);
        } catch (error) {
            logger.error('Error finding matches', { error });
            res.status(500).json({ error: 'Failed to find matches' });
        }
    }

    /**
     * POST /api/matchmaking/track
     * Track when a user joins a matched session
     */
    async trackJoin(req: AuthRequest, res: Response): Promise<void> {
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

            await matchmakingService.trackMatchAnalytics(
                userId,
                sessionId,
                matchScore || 0,
                true
            );

            res.json({ message: 'Join tracked successfully' });
        } catch (error) {
            logger.error('Error tracking join', { error });
            res.status(500).json({ error: 'Failed to track join' });
        }
    }

    /**
     * GET /api/matchmaking/analytics
     * Get matchmaking analytics for the current user
     */
    async getAnalytics(req: AuthRequest, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const { days } = req.query;
            const analytics = await matchmakingService.getAnalytics(
                userId,
                days ? parseInt(days as string, 10) : 7
            );

            // Calculate summary statistics
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
        } catch (error) {
            logger.error('Error getting analytics', { error });
            res.status(500).json({ error: 'Failed to get analytics' });
        }
    }

    /**
     * GET /api/matchmaking/enums
     * Get available enum values for preferences
     */
    async getEnums(req: AuthRequest, res: Response): Promise<void> {
        try {
            res.json({
                playstyles: Object.values(Playstyle),
                experienceLevels: Object.values(ExperienceLevel),
                availability: Object.values(Availability)
            });
        } catch (error) {
            logger.error('Error getting enums', { error });
            res.status(500).json({ error: 'Failed to get enums' });
        }
    }
}

// Lazy initialization - controller is instantiated on first access
let _matchmakingController: MatchmakingController | null = null;

export const matchmakingController = new Proxy({} as MatchmakingController, {
    get(target, prop) {
        if (!_matchmakingController) {
            _matchmakingController = new MatchmakingController();
        }
        return (_matchmakingController as unknown as Record<string, unknown>)[prop as string];
    }
});

