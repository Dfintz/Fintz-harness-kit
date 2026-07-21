import Joi from 'joi';

import { Playstyle, ExperienceLevel, Availability } from '../models/UserGameplayPreferences';

/**
 * Validation schema for setting gameplay preferences
 */
export const setPreferencesSchema = Joi.object({
    // Activity preferences (activity name -> weight 0-100)
    activityPreferences: Joi.object().pattern(
        Joi.string(),
        Joi.number().min(0).max(100)
    ).required(),

    // Experience levels for activities
    experienceLevels: Joi.object().pattern(
        Joi.string(),
        Joi.string().valid(...Object.values(ExperienceLevel))
    ).optional(),

    // Playstyles (at least one required)
    playstyles: Joi.array()
        .items(Joi.string().valid(...Object.values(Playstyle)))
        .min(1)
        .required(),

    // Group size preferences
    preferredGroupSizeMin: Joi.number().min(1).max(50).optional(),
    preferredGroupSizeMax: Joi.number().min(1).max(50).optional(),

    // Communication preferences
    requiresVoiceChat: Joi.boolean().optional(),
    prefersSilentPlay: Joi.boolean().optional(),

    // Timezone and availability
    timezone: Joi.string().optional(),
    availability: Joi.array()
        .items(Joi.string().valid(...Object.values(Availability)))
        .optional(),

    // Role preferences
    preferredRoles: Joi.array().items(Joi.string()).optional(),

    // Languages
    languages: Joi.array().items(Joi.string()).min(1).optional(),

    // Skill levels (0-100)
    combatSkill: Joi.number().min(0).max(100).optional(),
    pilotingSkill: Joi.number().min(0).max(100).optional(),
    tradingSkill: Joi.number().min(0).max(100).optional(),
    miningSkill: Joi.number().min(0).max(100).optional(),

    // Matchmaking preferences
    allowCrossOrgMatching: Joi.boolean().optional(),
    onlyMatchWithVerified: Joi.boolean().optional(),
    minReputationScore: Joi.number().min(0).max(100).optional()
}).custom((value, helpers) => {
    // Validate that min <= max for group size
    if (value.preferredGroupSizeMin && value.preferredGroupSizeMax) {
        if (value.preferredGroupSizeMin > value.preferredGroupSizeMax) {
            return helpers.error('custom.groupSize', {
                message: 'preferredGroupSizeMin must be less than or equal to preferredGroupSizeMax'
            });
        }
    }
    return value;
});

/**
 * Validation schema for finding matches
 */
export const findMatchesSchema = Joi.object({
    activityType: Joi.string().optional(),
    limit: Joi.number().min(1).max(50).optional()
});

/**
 * Validation schema for tracking join
 */
export const trackJoinSchema = Joi.object({
    sessionId: Joi.string().required(),
    matchScore: Joi.number().min(0).max(100).optional()
});

/**
 * Validation schema for getting analytics
 */
export const getAnalyticsSchema = Joi.object({
    days: Joi.number().min(1).max(90).optional()
});
