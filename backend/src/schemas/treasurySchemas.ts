import Joi from 'joi';

import { paginationKeys } from './common';

/**
 * Treasury validation schemas
 *
 * Covers credit operations, dues management, and commissary.
 */

const transactionTypes = ['income', 'expense', 'transfer', 'dues', 'reward', 'purchase'];
const duesFrequencies = ['weekly', 'biweekly', 'monthly', 'quarterly'];
const periods = ['day', 'week', 'month', 'quarter', 'year'];

export const treasurySchemas = {
  // ==================== CREDIT OPERATIONS ====================

  // POST /credits/earn
  earn: Joi.object({
    amount: Joi.number().positive().precision(2).max(999999999).required(),
    source: Joi.string().trim().min(1).max(500).required(),
    category: Joi.string().trim().max(100).optional(),
    metadata: Joi.object().optional(),
  }),

  // POST /credits/spend
  spend: Joi.object({
    amount: Joi.number().positive().precision(2).max(999999999).required(),
    purpose: Joi.string().trim().min(1).max(500).required(),
    category: Joi.string().trim().max(100).optional(),
    metadata: Joi.object().optional(),
  }),

  // POST /credits/transfer
  transfer: Joi.object({
    toUserId: Joi.string().trim().min(1).max(255).required(),
    amount: Joi.number().positive().precision(2).max(999999999).required(),
    note: Joi.string().trim().max(500).optional(),
  }),

  // GET /credits/transactions
  transactionQuery: Joi.object({
    ...paginationKeys,
    type: Joi.string()
      .valid(...transactionTypes)
      .optional(),
    category: Joi.string().trim().max(100).optional(),
    fromUserId: Joi.string().trim().max(255).optional(),
    toUserId: Joi.string().trim().max(255).optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    sortBy: Joi.string().valid('createdAt', 'amount').default('createdAt'),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
  }),

  // GET /credits/statistics
  statisticsQuery: Joi.object({
    period: Joi.string()
      .valid(...periods)
      .optional(),
  }),

  // GET /credits/leaderboard
  leaderboardQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(50).default(10),
  }),

  // ==================== DUES ====================

  // POST /credits/dues
  createDues: Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    amount: Joi.number().positive().precision(2).max(999999999).required(),
    frequency: Joi.string()
      .valid(...duesFrequencies)
      .required(),
    dueDay: Joi.number().integer().min(0).max(31).default(1),
    gracePeriodDays: Joi.number().integer().min(0).max(90).default(7),
  }),

  // PUT /credits/dues/:duesId
  updateDues: Joi.object({
    name: Joi.string().trim().min(1).max(255).optional(),
    amount: Joi.number().positive().precision(2).max(999999999).optional(),
    frequency: Joi.string()
      .valid(...duesFrequencies)
      .optional(),
    isActive: Joi.boolean().optional(),
    dueDay: Joi.number().integer().min(0).max(31).optional(),
    gracePeriodDays: Joi.number().integer().min(0).max(90).optional(),
  }),

  // GET /credits/dues
  duesQuery: Joi.object({
    ...paginationKeys,
    activeOnly: Joi.boolean().default(false),
  }),

  // ==================== COMMISSARY ====================

  // POST /credits/commissary
  createCommissaryItem: Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    description: Joi.string().trim().max(2000).optional(),
    price: Joi.number().positive().precision(2).max(999999999).required(),
    category: Joi.string().trim().min(1).max(100).required(),
    stock: Joi.number().integer().min(-1).default(-1),
    imageUrl: Joi.string().uri().max(1000).optional(),
    metadata: Joi.object().optional(),
  }),

  // PUT /credits/commissary/:itemId
  updateCommissaryItem: Joi.object({
    name: Joi.string().trim().min(1).max(255).optional(),
    description: Joi.string().trim().max(2000).optional(),
    price: Joi.number().positive().precision(2).max(999999999).optional(),
    category: Joi.string().trim().max(100).optional(),
    stock: Joi.number().integer().min(-1).optional(),
    isActive: Joi.boolean().optional(),
    imageUrl: Joi.string().uri().max(1000).allow('').optional(),
    metadata: Joi.object().optional(),
  }),

  // GET /credits/commissary
  commissaryQuery: Joi.object({
    ...paginationKeys,
    category: Joi.string().trim().max(100).optional(),
    activeOnly: Joi.boolean().default(true),
    searchTerm: Joi.string().trim().max(200).optional(),
    sortBy: Joi.string().valid('createdAt', 'price', 'name').default('createdAt'),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
  }),

  // POST /credits/commissary/:itemId/purchase
  purchase: Joi.object({
    quantity: Joi.number().integer().min(1).max(100).required(),
  }),

  // GET /credits/commissary/purchases
  purchaseQuery: Joi.object({
    ...paginationKeys,
    buyerId: Joi.string().trim().max(255).optional(),
  }),

  // ==================== PARAMS ====================

  duesParam: Joi.object({
    duesId: Joi.string().uuid().required(),
  }),

  itemParam: Joi.object({
    itemId: Joi.string().uuid().required(),
  }),
};
