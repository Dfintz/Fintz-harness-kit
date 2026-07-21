import Joi from 'joi';

import { paginationKeys } from './common';

/**
 * Validation schemas for public job listings
 * Phase 3: Public Job Listings feature
 */

// Valid enum values for validation
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

const primaryFocusValues = [
  'combat',
  'mining',
  'trading',
  'exploration',
  'bounty_hunting',
  'medical',
  'transport',
  'salvage',
  'security',
  'social',
  'piracy',
  'racing',
  'mixed',
];

const ownerTypeValues = ['organization', 'alliance', 'user'];

const listingCategoryValues = ['job', 'service'];

const sortByValues = ['postedAt', 'title', 'jobType', 'experienceLevel', 'payMin'];

const shipRequirementTypeValues = ['none', 'required', 'preferred'];

/**
 * Validates a single ship requirement entry (specific ship or role-based)
 */
const shipRequirementEntrySchema = Joi.alternatives().try(
  Joi.object({
    requirementType: Joi.string().valid('specific').required(),
    shipName: Joi.string().trim().min(1).max(200).required(),
    shipId: Joi.string().trim().optional(),
    count: Joi.number().integer().min(1).max(99).required(),
    crewPerShip: Joi.number().integer().min(0).max(500).required(),
  }),
  Joi.object({
    requirementType: Joi.string().valid('role').required(),
    role: Joi.string().trim().min(1).max(200).required(),
    count: Joi.number().integer().min(1).max(99).required(),
    avgCrewPerShip: Joi.number().min(0).max(500).required(),
  })
);

export const publicJobListingSchemas = {
  /**
   * Query parameters for job listings
   */
  jobListingQuery: Joi.object({
    // Allow simple pagination params (page/limit)
    ...paginationKeys,
    organizationId: Joi.string().uuid().optional(),
    allianceId: Joi.string().uuid().optional(),
    ownerType: Joi.string()
      .valid(...ownerTypeValues)
      .optional(),
    // Multi-select job type filter
    jobTypes: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().valid(...jobTypeValues)),
        Joi.string().valid(...jobTypeValues)
      )
      .optional(),
    // Multi-select focus filter
    focuses: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().valid(...primaryFocusValues)),
        Joi.string().valid(...primaryFocusValues)
      )
      .optional(),
    // Multi-select pay type filter
    payTypes: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().valid(...payTypeValues)),
        Joi.string().valid(...payTypeValues)
      )
      .optional(),
    minPay: Joi.number().integer().min(0).optional(),
    maxPay: Joi.number().integer().min(0).optional(),
    maxExperienceLevel: Joi.number().integer().min(0).max(10).optional(),
    search: Joi.string().trim().max(100).optional(),
    isActive: Joi.boolean().optional(),
    includeExpired: Joi.boolean().optional(),
    listingCategory: Joi.string()
      .valid(...listingCategoryValues)
      .optional(),
    sortBy: Joi.string()
      .valid(...sortByValues)
      .optional(),
    sortOrder: Joi.string().valid('ASC', 'DESC').optional(),
  }),

  /**
   * Create job listing
   */
  createJobListing: Joi.object({
    organizationId: Joi.string().uuid().when('ownerType', {
      is: 'organization',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    allianceId: Joi.string().uuid().when('ownerType', {
      is: 'alliance',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    ownerType: Joi.string()
      .valid(...ownerTypeValues)
      .default('user'),
    listingCategory: Joi.string()
      .valid(...listingCategoryValues)
      .default('job'),
    title: Joi.string().trim().min(5).max(255).required(),
    description: Joi.string().trim().max(5000).allow('', null).optional(),
    jobType: Joi.string()
      .valid(...jobTypeValues)
      .required(),
    focus: Joi.string()
      .valid(...primaryFocusValues)
      .default('mixed'),
    payType: Joi.string()
      .valid(...payTypeValues)
      .optional(),
    payMin: Joi.number().integer().min(0).optional(),
    payMax: Joi.number().integer().min(0).optional(),
    experienceLevel: Joi.number().integer().min(0).max(10).default(0),
    expiresAt: Joi.date().iso().min('now').optional(),
    contactInfo: Joi.string().trim().max(255).optional(),
    timezone: Joi.string().max(50).optional(),
    languages: Joi.array().items(Joi.string().max(20)).max(10).optional(),
    tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
    shipRequirementType: Joi.string()
      .valid(...shipRequirementTypeValues)
      .optional(),
    requiredShips: Joi.array().items(shipRequirementEntrySchema).max(50).optional(),
    crewSpotsTotal: Joi.number().integer().min(1).max(10000).optional(),
  }),

  /**
   * Update job listing
   */
  updateJobListing: Joi.object({
    listingCategory: Joi.string()
      .valid(...listingCategoryValues)
      .optional(),
    title: Joi.string().trim().min(5).max(255).optional(),
    description: Joi.string().trim().max(5000).allow('', null).optional(),
    jobType: Joi.string()
      .valid(...jobTypeValues)
      .optional(),
    focus: Joi.string()
      .valid(...primaryFocusValues)
      .optional(),
    payType: Joi.string()
      .valid(...payTypeValues)
      .optional(),
    payMin: Joi.number().integer().min(0).allow(null).optional(),
    payMax: Joi.number().integer().min(0).allow(null).optional(),
    experienceLevel: Joi.number().integer().min(0).max(10).optional(),
    isActive: Joi.boolean().optional(),
    expiresAt: Joi.date().iso().allow(null).optional(),
    contactInfo: Joi.string().trim().max(255).allow('', null).optional(),
    timezone: Joi.string().max(50).allow('', null).optional(),
    languages: Joi.array().items(Joi.string().max(20)).max(10).optional(),
    tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
    shipRequirementType: Joi.string()
      .valid(...shipRequirementTypeValues)
      .optional(),
    requiredShips: Joi.array().items(shipRequirementEntrySchema).max(50).allow(null).optional(),
    crewSpotsTotal: Joi.number().integer().min(1).max(10000).allow(null).optional(),
  }),

  /**
   * Assign crew role to a user on a ship
   */
  assignCrewRole: Joi.object({
    shipIndex: Joi.number().integer().min(0).required(),
    roleIndex: Joi.number().integer().min(0).required(),
    userId: Joi.string().trim().min(1).max(100).required(),
    userName: Joi.string().trim().min(1).max(255).required(),
  }),

  /**
   * Unassign crew role from a ship
   */
  unassignCrewRole: Joi.object({
    shipIndex: Joi.number().integer().min(0).required(),
    roleIndex: Joi.number().integer().min(0).required(),
  }),
};
