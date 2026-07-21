import Joi from 'joi';

import { applicationQuestionSchema } from './common';

/**
 * Joi validation schemas for application endpoints.
 *
 * Discriminators (targetType / applicantType) are set server-side;
 * clients send only the message, form responses, and query filters.
 */
export const orgApplicationSchemas = {
  /** POST /organizations/:orgId/applications — user applies to join org */
  submit: Joi.object({
    message: Joi.string().max(1000).optional().allow(''),
    formResponses: Joi.object().pattern(Joi.string().uuid(), Joi.string().max(2000)).optional(),
    source: Joi.string().valid('web', 'discord', 'api').optional(),
    // targetType and applicantType are server-determined — not client-settable
  }),

  /** PATCH /organizations/:orgId/applications/:id/review */
  review: Joi.object({
    decision: Joi.string().valid('approved', 'rejected').required(),
    note: Joi.string().max(500).optional().allow(''),
  }),

  /** GET /organizations/:orgId/applications (query params) */
  listQuery: Joi.object({
    status: Joi.string().valid('pending', 'approved', 'rejected', 'withdrawn').optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),
};

// ─── Application Question Schemas (Org Settings) ─────────────────────

export const applicationQuestionsSchema = Joi.object({
  applicationQuestions: Joi.array().items(applicationQuestionSchema).max(20).required(),
});
