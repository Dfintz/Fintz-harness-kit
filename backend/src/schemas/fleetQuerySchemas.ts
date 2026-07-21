import Joi from 'joi';

import { pagination } from './common';

export const fleetQuerySchemas = {
  listQuery: pagination.keys({
    searchTerm: Joi.string().trim().max(200).optional(),
    sortBy: Joi.string().valid('name', 'createdAt', 'memberCount', 'updatedAt').default('name'),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('ASC'),
  }),

  fleetIdParam: Joi.object({
    fleetId: Joi.string().trim().required(),
  }),

  memberIdParam: Joi.object({
    memberId: Joi.string().trim().required(),
  }),

  idParam: Joi.object({
    id: Joi.string().trim().required(),
  }),

  addMember: Joi.object({
    fleetId: Joi.string().trim().required(),
    userId: Joi.string().trim().required(),
    role: Joi.string().optional(),
    joinDate: Joi.date().iso().optional(),
  }),

  updateMember: Joi.object({
    status: Joi.string().optional(),
    role: Joi.string().optional(),
    approvedBy: Joi.string().trim().optional(),
  }),
};
