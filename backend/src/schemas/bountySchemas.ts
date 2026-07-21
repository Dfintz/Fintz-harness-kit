import Joi from 'joi';

import { id, paginationKeys } from './common';

/**
 * Bounty validation schemas
 *
 * Supports the 6 bounty types: kill, capture, intel, transport, rescue, custom
 * Phase 2: Includes claim and evidence submission schemas
 */

const bountyTypes = ['kill', 'capture', 'intel', 'transport', 'rescue', 'custom'];
const targetTypes = ['player', 'npc', 'ship', 'location', 'item', 'other'];
const rewardTypes = ['credits', 'item', 'reputation', 'mixed', 'other'];
const bountyStatuses = [
  'active',
  'claimed',
  'in_progress',
  'completed',
  'verified',
  'paid',
  'cancelled',
  'expired',
];
const difficultyLevels = ['easy', 'medium', 'hard', 'expert'];
const visibilityLevels = ['public', 'organization', 'alliance', 'private'];
const claimStatuses = ['active', 'submitted', 'completed', 'abandoned', 'rejected'];
const evidenceTypes = ['screenshot', 'video', 'text', 'link', 'file'];

export const bountySchemas = {
  // Create bounty
  create: Joi.object({
    title: Joi.string().trim().min(3).max(200).required(),
    description: Joi.string().trim().max(2000).optional(),
    bountyType: Joi.string()
      .valid(...bountyTypes)
      .required(),
    targetType: Joi.string()
      .valid(...targetTypes)
      .required(),
    targetIdentifier: Joi.string().trim().max(100).optional(),
    targetName: Joi.string().trim().max(100).optional(),
    targetDetails: Joi.object({
      lastKnownLocation: Joi.string().trim().max(200).optional(),
      shipType: Joi.string().trim().max(100).optional(),
      affiliations: Joi.array().items(Joi.string().trim().max(100)).optional(),
      threat_level: Joi.string().trim().max(50).optional(),
      notes: Joi.string().trim().max(1000).optional(),
      imageUrl: Joi.string().uri().optional(),
    }).optional(),
    rewardType: Joi.string()
      .valid(...rewardTypes)
      .required(),
    rewardAmount: Joi.number().integer().min(0).max(999999999).optional(),
    rewardDescription: Joi.string().trim().max(500).optional(),
    difficulty: Joi.string()
      .valid(...difficultyLevels)
      .optional(),
    location: Joi.string().trim().max(200).optional(),
    systemLocation: Joi.string().trim().max(100).optional(),
    expiresAt: Joi.date().iso().min('now').optional(),
    visibility: Joi.string()
      .valid(...visibilityLevels)
      .default('organization'),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(10).optional(),
    metadata: Joi.object().optional(),
  }),

  // Update bounty
  update: Joi.object({
    title: Joi.string().trim().min(3).max(200).optional(),
    description: Joi.string().trim().max(2000).optional(),
    targetIdentifier: Joi.string().trim().max(100).optional(),
    targetName: Joi.string().trim().max(100).optional(),
    targetDetails: Joi.object({
      lastKnownLocation: Joi.string().trim().max(200).optional(),
      shipType: Joi.string().trim().max(100).optional(),
      affiliations: Joi.array().items(Joi.string().trim().max(100)).optional(),
      threat_level: Joi.string().trim().max(50).optional(),
      notes: Joi.string().trim().max(1000).optional(),
      imageUrl: Joi.string().uri().optional(),
    }).optional(),
    rewardAmount: Joi.number().integer().min(0).max(999999999).optional(),
    rewardDescription: Joi.string().trim().max(500).optional(),
    difficulty: Joi.string()
      .valid(...difficultyLevels)
      .optional(),
    location: Joi.string().trim().max(200).optional(),
    systemLocation: Joi.string().trim().max(100).optional(),
    expiresAt: Joi.date().iso().optional(),
    visibility: Joi.string()
      .valid(...visibilityLevels)
      .optional(),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(10).optional(),
    metadata: Joi.object().optional(),
  }),

  // Claim bounty
  claim: Joi.object({
    notes: Joi.string().trim().max(500).optional(),
  }),

  // Complete bounty
  complete: Joi.object({
    evidence: Joi.array().items(Joi.string().trim().max(500)).max(10).optional(),
    completionNotes: Joi.string().trim().max(2000).optional(),
  }),

  // Verify bounty completion
  verify: Joi.object({
    approved: Joi.boolean().required(),
    verificationNotes: Joi.string().trim().max(1000).optional(),
  }),

  // Mark bounty as paid
  pay: Joi.object({
    paymentReference: Joi.string().trim().max(200).optional(),
    paymentNotes: Joi.string().trim().max(500).optional(),
  }),

  // Cancel bounty
  cancel: Joi.object({
    reason: Joi.string().trim().max(500).optional(),
  }),

  // Query/filter bounties
  query: Joi.object({
    ...paginationKeys,
    bountyType: Joi.string()
      .valid(...bountyTypes)
      .optional(),
    status: Joi.string()
      .valid(...bountyStatuses)
      .optional(),
    difficulty: Joi.string()
      .valid(...difficultyLevels)
      .optional(),
    visibility: Joi.string()
      .valid(...visibilityLevels)
      .optional(),
    targetType: Joi.string()
      .valid(...targetTypes)
      .optional(),
    createdBy: Joi.string().trim().optional(),
    claimedBy: Joi.string().trim().optional(),
    searchTerm: Joi.string().trim().max(200).optional(),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(10).optional(),
    minReward: Joi.number().integer().min(0).optional(),
    maxReward: Joi.number().integer().min(0).optional(),
    includeExpired: Joi.boolean().default(false),
    sortBy: Joi.string()
      .valid('createdAt', 'rewardAmount', 'expiresAt', 'title')
      .default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),

  // Bounty ID param
  param: Joi.object({
    id,
  }),

  // List my bounties (created or claimed)
  listMine: Joi.object({
    type: Joi.string().valid('created', 'claimed', 'both').default('both'),
    status: Joi.string()
      .valid(...bountyStatuses)
      .optional(),
    ...paginationKeys,
  }),
};

/**
 * Phase 2: Claim validation schemas
 */
export const claimSchemas = {
  // Create claim
  create: Joi.object({
    bountyId: Joi.string().uuid().required(),
    notes: Joi.string().trim().max(500).optional(),
  }),

  // Submit claim for review
  submit: Joi.object({
    completionNotes: Joi.string().trim().max(2000).optional(),
  }),

  // Abandon claim
  abandon: Joi.object({
    reason: Joi.string().trim().max(500).optional(),
  }),

  // Verify/reject claim
  verify: Joi.object({
    approved: Joi.boolean().required(),
    notes: Joi.string().trim().max(1000).optional(),
  }),

  // Phase 3: Approve claim
  approve: Joi.object({
    notes: Joi.string().trim().max(1000).optional(),
  }),

  // Phase 3: Reject claim
  reject: Joi.object({
    reason: Joi.string().trim().min(10).max(1000).required(),
  }),

  // Phase 3: Mark claim as paid
  pay: Joi.object({
    paymentReference: Joi.string().trim().max(200).optional(),
    paymentNotes: Joi.string().trim().max(500).optional(),
  }),

  // Query claims
  query: Joi.object({
    ...paginationKeys,
    status: Joi.string()
      .valid(...claimStatuses)
      .optional(),
    hunterId: Joi.string().uuid().optional(),
    bountyId: Joi.string().uuid().optional(),
    sortBy: Joi.string().valid('claimedAt', 'submittedAt', 'completedAt').default('claimedAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),

  // Claim ID param
  param: Joi.object({
    id,
  }),
};

/**
 * Phase 2: Evidence validation schemas
 */
export const evidenceSchemas = {
  // Submit evidence
  submit: Joi.object({
    evidenceType: Joi.string()
      .valid(...evidenceTypes)
      .required(),
    content: Joi.string().trim().max(5000).optional(),
    fileUrl: Joi.string().uri().max(500).optional(),
    fileName: Joi.string().trim().max(255).optional(),
    fileSize: Joi.number().integer().min(0).max(52428800).optional(), // 50MB max
    mimeType: Joi.string().trim().max(100).optional(),
  }).or('content', 'fileUrl'), // Require at least content or fileUrl

  // Evidence ID param
  param: Joi.object({
    id,
  }),

  // Query evidence
  query: Joi.object({
    claimId: Joi.string().uuid().required(),
    evidenceType: Joi.string()
      .valid(...evidenceTypes)
      .optional(),
  }),
};
