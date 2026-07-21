import Joi from 'joi';

import { id, notes, paginationKeys } from './common';

/**
 * Ship and maintenance validation schemas
 */

export const shipSchemas = {
  // Create/update ship
  create: Joi.object({
    name: Joi.string().trim().min(1).max(200).required(),
    model: Joi.string().trim().min(1).max(100).required(),
    manufacturer: Joi.string().trim().min(1).max(100).required(),
    role: Joi.string()
      .valid('combat', 'cargo', 'mining', 'exploration', 'support', 'multi-role')
      .required(),
    status: Joi.string()
      .valid('operational', 'maintenance', 'repair', 'decommissioned')
      .default('operational'),
    ownerId: id,
    cargoCapacity: Joi.number().integer().min(0).optional(),
    crewSize: Joi.number().integer().min(1).optional(),
    specifications: Joi.object().optional(),
  }),

  update: Joi.object({
    name: Joi.string().trim().min(1).max(200).optional(),
    status: Joi.string().valid('operational', 'maintenance', 'repair', 'decommissioned').optional(),
    ownerId: Joi.string().trim().optional(),
    cargoCapacity: Joi.number().integer().min(0).optional(),
    crewSize: Joi.number().integer().min(1).optional(),
  }),

  // Maintenance schedule
  scheduleMaintenance: Joi.object({
    shipId: id,
    maintenanceType: Joi.string().valid('routine', 'repair', 'upgrade', 'inspection').required(),
    scheduledDate: Joi.date().iso().required(),
    estimatedDuration: Joi.number().integer().min(1).required(), // hours
    estimatedCost: Joi.number().min(0).optional(),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
    notes,
  }),

  // Update maintenance status
  updateMaintenanceStatus: Joi.object({
    status: Joi.string().valid('scheduled', 'in_progress', 'completed', 'cancelled').required(),
    actualCost: Joi.number().min(0).optional(),
    actualDuration: Joi.number().integer().min(1).optional(),
    notes,
  }),

  // Ship query
  query: Joi.object({
    ...paginationKeys,
    role: Joi.string()
      .valid('combat', 'cargo', 'mining', 'exploration', 'support', 'multi-role')
      .optional(),
    status: Joi.string().valid('operational', 'maintenance', 'repair', 'decommissioned').optional(),
    ownerId: Joi.string().trim().optional(),
    manufacturer: Joi.string().trim().optional(),
  }),

  // Ship ID param
  param: Joi.object({
    id,
  }),

  createUserShip: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    shipType: Joi.string().trim().required(),
    manufacturer: Joi.string().trim().optional(),
    userId: id.required(),
  }),

  updateUserShip: Joi.object({
    name: Joi.string().trim().min(1).max(100).optional(),
    status: Joi.string().valid('active', 'maintenance', 'destroyed', 'stored').optional(),
    location: Joi.string().trim().optional(),
    notes: Joi.string().max(500).optional(),
  }),
};
