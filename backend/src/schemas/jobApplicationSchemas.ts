import Joi from 'joi';

/**
 * Validation schemas for job applications.
 */

const applicationTypeValues = ['crew', 'passenger', 'vehicle', 'general'];
const reviewStatusValues = ['approved', 'rejected', 'waitlisted'];
const applicationStatusValues = ['pending', 'approved', 'rejected', 'waitlisted', 'withdrawn'];

export const jobApplicationSchemas = {
  /**
   * Body for POST /api/jobs/:jobId/apply
   */
  applyToJob: Joi.object({
    applicationType: Joi.string()
      .valid(...applicationTypeValues)
      .required(),
    message: Joi.string().trim().max(1000).allow('', null).optional(),

    // crew-specific
    shipIndex: Joi.number().integer().min(0).when('applicationType', {
      is: 'crew',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    roleIndex: Joi.number().integer().min(0).when('applicationType', {
      is: 'crew',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),

    // passenger-specific
    passengerShipIndex: Joi.number().integer().min(0).when('applicationType', {
      is: 'passenger',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    passengerRole: Joi.string().trim().max(100).when('applicationType', {
      is: 'passenger',
      then: Joi.optional(),
      otherwise: Joi.optional(),
    }),

    // vehicle-specific
    vehicleName: Joi.string().trim().max(255).when('applicationType', {
      is: 'vehicle',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),

    // org application form responses (questionId → answer)
    formResponses: Joi.object()
      .pattern(Joi.string().uuid(), Joi.string().max(5000))
      .max(20)
      .optional(),
  }),

  /**
   * Body for PATCH /api/jobs/:jobId/applications/:applicationId/review
   */
  reviewApplication: Joi.object({
    status: Joi.string()
      .valid(...reviewStatusValues)
      .required(),
    reviewNote: Joi.string().trim().max(1000).allow('', null).optional(),
  }),

  /**
   * Query params for GET /api/jobs/:jobId/applications
   */
  applicationListQuery: Joi.object({
    status: Joi.string()
      .valid(...applicationStatusValues)
      .optional(),
  }),
};
