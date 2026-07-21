import Joi from 'joi';

import { paginationKeys } from './common';

/**
 * Loot distribution validation schemas.
 *
 * Covers loot pools, items, claims/bids, and distribution for the commissary
 * loot distribution feature.
 */

const distributionMethods = [
  'need_greed',
  'random_roll',
  'auec_bid',
  'even_split',
  'leader_assign',
];
const itemCategories = ['gear', 'component', 'commodity', 'weapon', 'ship', 'other'];
const itemSources = ['manual', 'ocr'];
const claimTypes = ['need', 'greed', 'roll', 'bid'];
const poolStatuses = ['open', 'locked', 'distributed', 'partially_distributed', 'cancelled'];

const rulesSchema = Joi.object({
  maxItemsPerParticipant: Joi.number().integer().min(1).max(1000).optional(),
  shareTotalPayout: Joi.boolean().optional(),
  roleWeights: Joi.object().pattern(Joi.string(), Joi.number().positive()).optional(),
  eligibleRoles: Joi.array().items(Joi.string().trim().max(50)).max(50).optional(),
  closesAt: Joi.date().iso().optional(),
  minBidIncrement: Joi.number().positive().max(999999999).optional(),
  notes: Joi.string().trim().max(2000).optional(),
});

const itemSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  category: Joi.string()
    .valid(...itemCategories)
    .default('other'),
  quantity: Joi.number().integer().min(1).max(1000000).default(1),
  unitValue: Joi.number().min(0).precision(2).max(999999999).default(0),
  imageUrl: Joi.string().uri().max(1000).optional(),
  source: Joi.string()
    .valid(...itemSources)
    .default('manual'),
  metadata: Joi.object().optional(),
});

export const lootSchemas = {
  // ==================== POOLS ====================

  // POST /loot/pools
  createPool: Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    description: Joi.string().trim().max(2000).optional(),
    activityId: Joi.string().uuid().required(),
    missionId: Joi.string().uuid().optional(),
    lfgSessionId: Joi.string().trim().max(255).optional(),
    distributionMethod: Joi.string()
      .valid(...distributionMethods)
      .default('need_greed'),
    rules: rulesSchema.optional(),
    assistantUserIds: Joi.array().items(Joi.string().trim().min(1).max(255)).max(25).optional(),
    currency: Joi.string().trim().max(10).default('aUEC'),
  }),

  // PATCH /loot/pools/:poolId
  updatePool: Joi.object({
    name: Joi.string().trim().min(1).max(255).optional(),
    description: Joi.string().trim().max(2000).allow('').optional(),
    distributionMethod: Joi.string()
      .valid(...distributionMethods)
      .optional(),
    rules: rulesSchema.optional(),
    assistantUserIds: Joi.array().items(Joi.string().trim().min(1).max(255)).max(25).optional(),
  }).min(1),

  // GET /loot/pools
  listQuery: Joi.object({
    ...paginationKeys,
    activityId: Joi.string().uuid().optional(),
    status: Joi.string()
      .valid(...poolStatuses)
      .optional(),
  }),

  // ==================== ITEMS ====================

  // POST /loot/pools/:poolId/items
  addItem: itemSchema,

  // POST /loot/pools/:poolId/items/bulk
  addItemsBulk: Joi.object({
    items: Joi.array().items(itemSchema).min(1).max(200).required(),
  }),

  // PATCH /loot/pools/:poolId/items/:itemId
  updateItem: Joi.object({
    name: Joi.string().trim().min(1).max(255).optional(),
    category: Joi.string()
      .valid(...itemCategories)
      .optional(),
    quantity: Joi.number().integer().min(1).max(1000000).optional(),
    unitValue: Joi.number().min(0).precision(2).max(999999999).optional(),
    imageUrl: Joi.string().uri().max(1000).allow('').optional(),
  }).min(1),

  // POST /loot/pools/:poolId/items/:itemId/assign
  assignItem: Joi.object({
    userId: Joi.string().trim().min(1).max(255).required(),
  }),

  // ==================== CLAIMS ====================

  // POST /loot/pools/:poolId/items/:itemId/claim
  claim: Joi.object({
    claimType: Joi.string()
      .valid(...claimTypes)
      .required(),
    bidAmount: Joi.number().positive().precision(2).max(999999999).when('claimType', {
      is: 'bid',
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
  }),

  // ==================== PARAMS ====================

  poolParam: Joi.object({
    poolId: Joi.string().uuid().required(),
  }),

  itemParam: Joi.object({
    poolId: Joi.string().uuid().required(),
    itemId: Joi.string().uuid().required(),
  }),
};
