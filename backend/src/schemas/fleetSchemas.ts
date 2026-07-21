import Joi from 'joi';

import { description, id, idArray, paginationKeys } from './common';

/**
 * Fleet validation schemas
 */

export const fleetSchemas = {
  // Single fleet member (requires fleetId in body for legacy route compatibility)
  singleMember: Joi.object({
    fleetId: id.required(),
    userId: id,
    role: Joi.string().trim().max(50).optional(),
    shipType: Joi.string().trim().max(100).optional(),
    status: Joi.string().valid('active', 'inactive', 'on_leave', 'deployed').optional(),
  }),

  // Bulk add members
  bulkAddMembers: Joi.object({
    members: Joi.array()
      .items(
        Joi.object({
          userId: id,
          role: Joi.string().trim().max(50).optional(),
          shipType: Joi.string().trim().max(100).optional(),
          status: Joi.string()
            .valid('active', 'inactive', 'on_leave', 'deployed')
            .default('active'),
        })
      )
      .min(1)
      .max(100)
      .required(),
  }),

  // Bulk update members
  bulkUpdateMembers: Joi.object({
    updates: Joi.array()
      .items(
        Joi.object({
          id,
          data: Joi.object({
            role: Joi.string().trim().max(50).optional(),
            shipType: Joi.string().trim().max(100).optional(),
            status: Joi.string().valid('active', 'inactive', 'on_leave', 'deployed').optional(),
          }).required(),
        })
      )
      .min(1)
      .max(100)
      .required(),
  }),

  // Bulk delete members
  bulkDeleteMembers: Joi.object({
    memberIds: idArray,
  }),

  // Bulk update status
  bulkUpdateStatus: Joi.object({
    memberIds: idArray,
    status: Joi.string().valid('active', 'inactive', 'on_leave', 'deployed').required(),
  }),

  // Fleet member filters
  query: Joi.object({
    ...paginationKeys,
    fleetId: Joi.string().trim().optional(),
    role: Joi.string().trim().optional(),
    shipType: Joi.string().trim().optional(),
    status: Joi.string().valid('active', 'inactive', 'on_leave', 'deployed').optional(),
  }),

  // Compare fleets
  compareFleets: Joi.object({
    fleetIds: Joi.array().items(id).min(2).max(10).required(),
  }),

  // Fleet ID param
  param: Joi.object({
    fleetId: id,
  }),

  // Fleet analytics query
  analyticsQuery: Joi.object({
    days: Joi.number().integer().min(1).max(365).default(30),
  }),

  uploadCSV: Joi.object({
    file: Joi.any().required(),
    organizationId: id.optional(),
  }),

  memberId: Joi.object({
    memberId: id.required(),
  }),

  updateMember: Joi.object({
    role: Joi.string().optional(),
    status: Joi.string().valid('active', 'inactive', 'on_leave', 'deployed').optional(),
    notes: Joi.string().max(500).optional(),
  }),

  analyticsWithDays: Joi.object({
    days: Joi.number().integer().min(1).max(365).default(30),
  }),

  // Move fleet to a new parent (Wave 2.2 — Hierarchy)
  moveFleet: Joi.object({
    parentFleetId: Joi.string().trim().max(100).allow(null).required(),
  }),

  // Reorder fleets within a parent (Wave 2.2 — Hierarchy)
  reorderFleets: Joi.object({
    orderedIds: Joi.array().items(id).min(1).max(100).required(),
    parentFleetId: Joi.string().trim().max(100).allow(null).optional(),
  }),

  // Deploy fleet (Sprint 18 — Aggregator)
  deployFleet: Joi.object({
    location: Joi.string().trim().min(1).max(255).required(),
    mission: Joi.string().trim().max(500).optional(),
    objectives: Joi.array().items(Joi.string().trim().max(255)).max(20).optional(),
    estimatedDuration: Joi.number().integer().positive().optional(),
    notifyMembers: Joi.boolean().default(true),
  }),

  // Dissolve fleet (Sprint 18 — Aggregator)
  dissolveFleet: Joi.object({
    reason: Joi.string().trim().max(500).optional(),
    reassignShipsToFleetId: Joi.string().trim().max(100).optional().allow(null),
    notifyMembers: Joi.boolean().default(true),
  }),

  // Create fleet (basic)
  createFleet: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    description: Joi.string().trim().max(500).optional(),
    type: Joi.string()
      .valid(
        'combat',
        'mining',
        'trading',
        'exploration',
        'salvage',
        'escort',
        'reconnaissance',
        'medical',
        'mixed'
      )
      .optional(),
    members: Joi.array().items(Joi.string().trim()).max(100).optional(),
    emblem: Joi.string().uri().trim().max(500).allow('', null).optional(),
  }),

  // Create fleet with assets (Sprint 18 — Aggregator)
  createFleetWithAssets: Joi.object({
    fleetData: Joi.object({
      name: Joi.string().trim().min(1).max(100).required(),
      description,
      leaderId: Joi.string().trim().max(100).optional(),
    }).required(),
    shipIds: idArray.optional(),
    squadronData: Joi.object({
      name: Joi.string().trim().min(1).max(100).required(),
      description: Joi.string().trim().max(500).optional(),
    }).optional(),
    inventoryItems: Joi.array()
      .items(
        Joi.object({
          itemId: Joi.string().trim().max(100).required(),
          quantity: Joi.number().integer().positive().required(),
        })
      )
      .max(100)
      .optional(),
    notifyMembers: Joi.boolean().default(false),
    postToDiscord: Joi.boolean().default(false),
    discordChannelId: Joi.string().trim().max(100).optional(),
  }),
};
