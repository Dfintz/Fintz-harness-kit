import Joi from 'joi';

import { id, idArray, notes, paginationKeysWith } from './common';

/**
 * Organization Ship Validation Schemas
 *
 * Validation for organization-owned fleet management
 */

export const organizationShipSchemas = {
  // Create org ship
  createOrgShip: Joi.object({
    shipId: id,
    shipName: Joi.string().trim().min(1).max(200).required(),
    customName: Joi.string().trim().max(200).optional().allow(null),
    role: Joi.string()
      .valid(
        'command',
        'combat',
        'logistics',
        'mining',
        'exploration',
        'medical',
        'transport',
        'support',
        'reserve'
      )
      .default('reserve'),
    status: Joi.string()
      .valid('owned', 'pledged', 'loaned', 'gifted', 'lost', 'destroyed', 'sold')
      .default('owned'),
    condition: Joi.string()
      .valid('pristine', 'excellent', 'good', 'fair', 'poor', 'damaged', 'critical')
      .default('good'),
    acquisitionMethod: Joi.string().trim().max(100).optional().allow(null),
    acquiredBy: id.optional().allow(null),
    acquiredDate: Joi.date().iso().optional().allow(null),
    acquisitionCost: Joi.number().min(0).max(9999999999.99).optional().allow(null),
    maxCrew: Joi.number().integer().min(1).max(100).optional().allow(null),
    location: Joi.string().trim().max(200).optional().allow(null),
    homeBase: Joi.string().trim().max(200).optional().allow(null),
    insuranceLevel: Joi.string().trim().max(100).optional().allow(null),
    insuranceExpires: Joi.date().iso().optional().allow(null),
    isCapital: Joi.boolean().default(false),
    requiresPermission: Joi.boolean().default(false),
    minimumRank: Joi.string().trim().max(50).optional().allow(null),
    sharingLevel: Joi.string()
      .valid('private', 'personal', 'shared_users', 'organization', 'alliance', 'public')
      .default('organization')
      .optional(),
    minRequiredRank: Joi.number().integer().min(1).max(10).optional().allow(null),
    useCustomVisibility: Joi.boolean().default(false).optional(),
    notes,
    tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
    modifications: Joi.object({
      components: Joi.array().items(Joi.string()).optional(),
      weapons: Joi.array().items(Joi.string()).optional(),
      upgrades: Joi.array().items(Joi.string()).optional(),
      cargo: Joi.any().optional(),
    })
      .optional()
      .allow(null),
  }),

  // Update org ship
  updateOrgShip: Joi.object({
    customName: Joi.string().trim().max(200).optional().allow(null),
    role: Joi.string()
      .valid(
        'command',
        'combat',
        'logistics',
        'mining',
        'exploration',
        'medical',
        'transport',
        'support',
        'reserve'
      )
      .optional(),
    status: Joi.string()
      .valid('owned', 'pledged', 'loaned', 'gifted', 'lost', 'destroyed', 'sold')
      .optional(),
    condition: Joi.string()
      .valid('pristine', 'excellent', 'good', 'fair', 'poor', 'damaged', 'critical')
      .optional(),
    location: Joi.string().trim().max(200).optional().allow(null),
    homeBase: Joi.string().trim().max(200).optional().allow(null),
    insuranceLevel: Joi.string().trim().max(100).optional().allow(null),
    insuranceExpires: Joi.date().iso().optional().allow(null),
    lastMaintenance: Joi.date().iso().optional().allow(null),
    nextMaintenance: Joi.date().iso().optional().allow(null),
    isAvailable: Joi.boolean().optional(),
    isActive: Joi.boolean().optional(),
    requiresPermission: Joi.boolean().optional(),
    minimumRank: Joi.string().trim().max(50).optional().allow(null),
    sharingLevel: Joi.string()
      .valid('private', 'personal', 'shared_users', 'organization', 'alliance', 'public')
      .optional(),
    minRequiredRank: Joi.number().integer().min(1).max(10).optional().allow(null),
    useCustomVisibility: Joi.boolean().optional(),
    notes,
    tags: Joi.array().items(Joi.string().trim().max(50)).max(20).optional(),
    flightHours: Joi.number().integer().min(0).optional(),
    missionsCompleted: Joi.number().integer().min(0).optional(),
    totalEarnings: Joi.number().min(0).max(9999999999999.99).optional(),
    maintenanceCosts: Joi.number().min(0).max(9999999999999.99).optional(),
    modifications: Joi.object({
      components: Joi.array().items(Joi.string()).optional(),
      weapons: Joi.array().items(Joi.string()).optional(),
      upgrades: Joi.array().items(Joi.string()).optional(),
      cargo: Joi.any().optional(),
    })
      .optional()
      .allow(null),
  }),

  // Assign captain
  assignCaptain: Joi.object({
    captainId: id,
  }),

  // Assign crew (full replacement)
  assignCrew: Joi.object({
    crewIds: idArray,
  }),

  // Add single crew member
  addCrewMember: Joi.object({
    userId: id,
  }),

  // Query filters
  query: Joi.object({
    role: Joi.string()
      .valid(
        'command',
        'combat',
        'logistics',
        'mining',
        'exploration',
        'medical',
        'transport',
        'support',
        'reserve'
      )
      .optional(),
    status: Joi.string()
      .valid('owned', 'pledged', 'loaned', 'gifted', 'lost', 'destroyed', 'sold')
      .optional(),
    condition: Joi.string()
      .valid('pristine', 'excellent', 'good', 'fair', 'poor', 'damaged', 'critical')
      .optional(),
    isAvailable: Joi.boolean().optional(),
    isCapital: Joi.boolean().optional(),
    isActive: Joi.boolean().optional(),
    requiresPermission: Joi.boolean().optional(),
    sharingLevel: Joi.string()
      .valid('private', 'personal', 'shared_users', 'organization', 'alliance', 'public')
      .optional(),
    minRequiredRank: Joi.number().integer().min(1).max(10).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    search: Joi.string().trim().max(200).optional(),
    ...paginationKeysWith(25, 500),
  }),
};
