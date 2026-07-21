import Joi from 'joi';

import { paginationKeys } from './common';

// Activity type enum values
const activityTypeValues = [
  'mission',
  'contract',
  'bounty',
  'event',
  'lfg',
  'operation',
  'recruitment',
  'job_listing',
];

// Activity status enum values
const activityStatusValues = [
  'draft',
  'open',
  'planning',
  'recruiting',
  'ready',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
  'expired',
];

// Job type values
const jobTypeValues = [
  'crew',
  'pilot',
  'gunner',
  'engineer',
  'medic',
  'miner',
  'hauler',
  'scout',
  'security',
  'leadership',
  'support',
  'other',
];

const payTypeValues = ['fixed', 'hourly', 'percentage', 'negotiable', 'volunteer'];
const listingCategoryValues = ['job', 'service'];
const sourceTypeValues = ['all', 'job', 'activity'];
const sortByValues = ['postedAt', 'title'];

export const opportunitySearchSchemas = {
  /**
   * Query parameters for unified opportunity search
   */
  searchQuery: Joi.object({
    // Pagination
    ...paginationKeys,

    // Source type filter
    sourceType: Joi.string()
      .valid(...sourceTypeValues)
      .default('all'),

    // Global search
    searchTerm: Joi.string().trim().max(200).optional(),

    // Organization filter
    organizationId: Joi.string().uuid().optional(),

    // Tags filter (comma-separated string, split into array by the controller)
    tags: Joi.string().trim().max(500).optional(),

    // Job-specific filters
    jobTypes: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().valid(...jobTypeValues)),
        Joi.string().valid(...jobTypeValues)
      )
      .optional(),
    payTypes: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().valid(...payTypeValues)),
        Joi.string().valid(...payTypeValues)
      )
      .optional(),
    listingCategory: Joi.string()
      .valid(...listingCategoryValues)
      .optional(),
    minPay: Joi.number().integer().min(0).optional(),
    maxPay: Joi.number().integer().min(0).optional(),

    // Activity-specific filters
    activityTypes: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().valid(...activityTypeValues)),
        Joi.string().valid(...activityTypeValues)
      )
      .optional(),
    activityStatus: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().valid(...activityStatusValues)),
        Joi.string().valid(...activityStatusValues)
      )
      .optional(),
    hasOpenSlots: Joi.boolean().optional(),
    isFeatured: Joi.boolean().optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),

    // Advanced filters (Sprint 23-E)
    minReputationScore: Joi.number().integer().min(0).max(100).optional(),
    reputationTiers: Joi.string().trim().max(200).optional(),
    minSuccessRate: Joi.number().integer().min(0).max(100).optional(),

    // Sort
    sortBy: Joi.string()
      .valid(...sortByValues)
      .optional(),
    sortOrder: Joi.string().valid('ASC', 'DESC').optional(),
  }),
};
