import Joi from 'joi';

import { notes, optionalUuid, paginationKeys } from './common';

/**
 * Mission Validation Schemas
 *
 * Validation for mission CRUD, status transitions, participant management,
 * and paginated queries. Enum values match the Mission entity.
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

const missionStatuses = [
  'draft',
  'planned',
  'briefed',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
] as const;

const difficulties = ['trivial', 'easy', 'medium', 'hard', 'extreme'] as const;
const priorities = ['low', 'normal', 'high', 'critical'] as const;
const participantRoles = ['leader', 'member', 'support', 'reserve'] as const;
const workflowPhases = ['dispatch', 'quartermaster', 'execution', 'after_action'] as const;

export const missionSchemas = {
  /** Create a new mission */
  create: Joi.object({
    title: Joi.string().trim().min(3).max(200).required().messages({
      'string.empty': 'Title is required',
      'any.required': 'Title is required',
    }),
    description: Joi.string().trim().max(5000).optional().allow(null, ''),
    missionType: Joi.string()
      .valid(...missionTypes)
      .default('custom'),
    difficulty: Joi.string()
      .valid(...difficulties)
      .default('medium'),
    priority: Joi.string()
      .valid(...priorities)
      .default('normal'),
    fleetId: optionalUuid.allow(null),
    location: Joi.string().trim().max(200).optional().allow(null, ''),
    objectives: Joi.array()
      .items(
        Joi.object({
          title: Joi.string().trim().min(1).max(300).required(),
          description: Joi.string().trim().max(1000).optional().allow(null, ''),
          optional: Joi.boolean().default(false),
        })
      )
      .max(50)
      .optional(),
    tags: Joi.array().items(Joi.string().trim().min(1).max(50)).max(20).optional(),
    reward: Joi.string().trim().max(500).optional().allow(null, ''),
    startDate: Joi.date().iso().optional().allow(null),
    endDate: Joi.date().iso().optional().allow(null),
    notes,
  }),

  /** Update an existing mission */
  update: Joi.object({
    title: Joi.string().trim().min(3).max(200).optional(),
    description: Joi.string().trim().max(5000).optional().allow(null, ''),
    missionType: Joi.string()
      .valid(...missionTypes)
      .optional(),
    status: Joi.string()
      .valid(...missionStatuses)
      .optional(),
    difficulty: Joi.string()
      .valid(...difficulties)
      .optional(),
    priority: Joi.string()
      .valid(...priorities)
      .optional(),
    fleetId: optionalUuid.allow(null),
    location: Joi.string().trim().max(200).optional().allow(null, ''),
    objectives: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().uuid().optional(),
          title: Joi.string().trim().min(1).max(300).required(),
          description: Joi.string().trim().max(1000).optional().allow(null, ''),
          completed: Joi.boolean().optional(),
          optional: Joi.boolean().optional(),
          order: Joi.number().integer().min(0).optional(),
        })
      )
      .max(50)
      .optional(),
    tags: Joi.array().items(Joi.string().trim().min(1).max(50)).max(20).optional(),
    reward: Joi.string().trim().max(500).optional().allow(null, ''),
    startDate: Joi.date().iso().optional().allow(null),
    endDate: Joi.date().iso().optional().allow(null),
    notes,
  }),

  /** Assign user to mission */
  assign: Joi.object({
    userId: Joi.string().trim().min(1).max(100).required().messages({
      'string.empty': 'User ID is required',
      'any.required': 'User ID is required',
    }),
    role: Joi.string()
      .valid(...participantRoles)
      .default('leader'),
  }),

  /** Complete or fail a mission */
  complete: Joi.object({
    status: Joi.string().valid('completed', 'failed').required().messages({
      'any.required': 'Outcome status is required',
    }),
    notes: Joi.string().trim().max(5000).optional().allow(null, ''),
  }),

  /** Advance command workflow phase */
  advanceWorkflow: Joi.object({
    phase: Joi.string()
      .valid(...workflowPhases)
      .required(),
    notes: Joi.string().trim().max(5000).optional().allow(null, ''),
  }),

  /** Update mission status */
  updateStatus: Joi.object({
    status: Joi.string()
      .valid(...missionStatuses)
      .required()
      .messages({
        'any.required': 'Status is required',
      }),
  }),

  /** Add a participant */
  addParticipant: Joi.object({
    userId: Joi.string().trim().min(1).max(100).required(),
    role: Joi.string()
      .valid(...participantRoles)
      .default('member'),
  }),

  /** Add an objective */
  addObjective: Joi.object({
    title: Joi.string().trim().min(1).max(300).required(),
    description: Joi.string().trim().max(1000).optional().allow(null, ''),
    optional: Joi.boolean().default(false),
  }),

  /** Update an objective */
  updateObjective: Joi.object({
    title: Joi.string().trim().min(1).max(300).optional(),
    description: Joi.string().trim().max(1000).optional().allow(null, ''),
    completed: Joi.boolean().optional(),
    optional: Joi.boolean().optional(),
  }),

  /** Query / filter missions (query string) */
  query: Joi.object({
    ...paginationKeys,
    sortBy: Joi.string()
      .valid(
        'createdAt',
        'updatedAt',
        'title',
        'status',
        'priority',
        'difficulty',
        'startDate',
        'missionType'
      )
      .default('createdAt'),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
    status: Joi.string()
      .valid(...missionStatuses)
      .optional(),
    missionType: Joi.string()
      .valid(...missionTypes)
      .optional(),
    difficulty: Joi.string()
      .valid(...difficulties)
      .optional(),
    priority: Joi.string()
      .valid(...priorities)
      .optional(),
    createdBy: Joi.string().trim().max(100).optional(),
    assignedTo: Joi.string().trim().max(100).optional(),
    fleetId: Joi.string().uuid().optional(),
    tags: Joi.alternatives()
      .try(Joi.array().items(Joi.string().trim().max(50)), Joi.string().trim().max(50))
      .optional(),
    search: Joi.string().trim().max(200).optional(),
    startDateFrom: Joi.date().iso().optional(),
    startDateTo: Joi.date().iso().optional(),
  }),

  /** Mission ID parameter */
  idParam: Joi.object({
    missionId: Joi.string().uuid().required(),
  }),

  /** Objective ID parameter */
  objectiveIdParam: Joi.object({
    missionId: Joi.string().uuid().required(),
    objectiveId: Joi.string().uuid().required(),
  }),

  /** Participant user ID parameter */
  participantIdParam: Joi.object({
    missionId: Joi.string().uuid().required(),
    userId: Joi.string().trim().min(1).max(100).required(),
  }),

  scmdbSearchQuery: Joi.object({
    search: Joi.string().trim().max(200).optional(),
    category: Joi.string().trim().max(100).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),

  importScmdbMissions: Joi.object({
    items: Joi.array()
      .items(
        Joi.object({
          externalId: Joi.string().trim().required(),
          priority: Joi.string()
            .valid(...priorities)
            .optional(),
          startDate: Joi.date().iso().optional(),
          endDate: Joi.date().iso().optional(),
          notes: Joi.string().trim().max(5000).optional().allow(null, ''),
        })
      )
      .min(1)
      .max(100)
      .required(),
  }),

  /** Import SCMDB mission by URL or ID */
  importScmdbByUrl: Joi.object({
    url: Joi.string().trim().required().messages({
      'string.empty': 'Mission URL or ID is required',
      'any.required': 'Mission URL or ID is required',
    }),
    priority: Joi.string()
      .valid(...priorities)
      .optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    notes: Joi.string().trim().max(5000).optional().allow(null, ''),
  }),

  /** Get available SCMDB filter options */
  scmdbFiltersQuery: Joi.object({
    // No required params; optional source filter for future multi-catalog support
    source: Joi.string().trim().max(50).optional(),
  }),
};
