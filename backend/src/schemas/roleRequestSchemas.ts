import Joi from 'joi';

/**
 * Validation schemas for the role-change request endpoints
 * (`/api/v2/role-requests`).
 */
export const roleRequestSchemas = {
  /** POST /role-requests */
  create: Joi.object({
    roleId: Joi.string().uuid().required(),
    reason: Joi.string().max(1000).allow('', null).optional(),
  }),

  /** POST /role-requests/:approvalId/approve */
  approve: Joi.object({
    comment: Joi.string().max(1000).allow('', null).optional(),
  }),

  /** POST /role-requests/:approvalId/reject */
  reject: Joi.object({
    reason: Joi.string().min(1).max(1000).required(),
  }),

  /** :approvalId path param */
  param: Joi.object({
    approvalId: Joi.string().uuid().required(),
  }),
};
