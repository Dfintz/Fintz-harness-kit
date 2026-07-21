import Joi from 'joi';

/**
 * AI Generation Validation Schemas
 *
 * Validation for AI briefing generation requests and usage queries.
 * Enum values match the Mission entity.
 */

const missionTypes = [
  'combat',
  'mining',
  'trading',
  'exploration',
  'logistics',
  'rescue',
  'reconnaissance',
  'escort',
  'salvage',
  'custom',
] as const;

const difficulties = ['trivial', 'easy', 'medium', 'hard', 'extreme'] as const;

export const aiGenerationSchemas = {
  /**
   * POST /missions/:missionId/generate-briefing
   *
   * Body payload for AI briefing generation. Most fields are optional
   * because the controller can prefill from the Mission entity.
   */
  generateBriefing: Joi.object({
    missionType: Joi.string()
      .valid(...missionTypes)
      .optional()
      .messages({ 'any.only': 'missionType must be a valid mission type' }),

    difficulty: Joi.string()
      .valid(...difficulties)
      .optional()
      .messages({ 'any.only': 'difficulty must be a valid difficulty level' }),

    objectives: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().trim().optional(),
          title: Joi.string().trim().min(1).max(300).required(),
          description: Joi.string().trim().max(1000).optional().allow(null, ''),
          completed: Joi.boolean().optional().default(false),
          optional: Joi.boolean().optional().default(false),
          order: Joi.number().integer().min(0).optional().default(0),
        })
      )
      .max(50)
      .optional(),

    location: Joi.string().trim().max(200).optional().allow(null, ''),

    fleetComposition: Joi.array()
      .items(
        Joi.object({
          shipName: Joi.string().trim().min(1).max(100).required(),
          role: Joi.string().trim().min(1).max(100).required(),
        })
      )
      .max(100)
      .optional(),

    participantCount: Joi.number().integer().min(1).max(1000).optional(),

    estimatedDuration: Joi.number()
      .integer()
      .min(1)
      .max(10080)
      .optional()
      .messages({ 'number.max': 'Estimated duration cannot exceed 7 days (10080 minutes)' }),

    additionalContext: Joi.string().trim().max(2000).optional().allow(null, ''),
  }),

  /**
   * POST /missions/:missionId/generate-briefing-stream
   * Same schema as generateBriefing.
   */
  generateBriefingStream: Joi.object({
    missionType: Joi.string()
      .valid(...missionTypes)
      .optional(),
    difficulty: Joi.string()
      .valid(...difficulties)
      .optional(),
    objectives: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().trim().optional(),
          title: Joi.string().trim().min(1).max(300).required(),
          description: Joi.string().trim().max(1000).optional().allow(null, ''),
          completed: Joi.boolean().optional().default(false),
          optional: Joi.boolean().optional().default(false),
          order: Joi.number().integer().min(0).optional().default(0),
        })
      )
      .max(50)
      .optional(),
    location: Joi.string().trim().max(200).optional().allow(null, ''),
    fleetComposition: Joi.array()
      .items(
        Joi.object({
          shipName: Joi.string().trim().min(1).max(100).required(),
          role: Joi.string().trim().min(1).max(100).required(),
        })
      )
      .max(100)
      .optional(),
    participantCount: Joi.number().integer().min(1).max(1000).optional(),
    estimatedDuration: Joi.number().integer().min(1).max(10080).optional(),
    additionalContext: Joi.string().trim().max(2000).optional().allow(null, ''),
  }),
};
