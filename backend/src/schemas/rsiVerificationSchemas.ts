import Joi from 'joi';

/**
 * RSI Verification Validation Schemas
 *
 * Validation for RSI account ownership verification endpoints
 */

export const rsiVerificationSchemas = {
  /**
   * Initiate RSI verification
   * Validates the RSI handle provided by the user
   */
  initiateVerification: Joi.object({
    rsiHandle: Joi.string()
      .trim()
      .min(3)
      .max(60)
      .pattern(/^[a-zA-Z0-9_-]+$/)
      .required()
      .messages({
        'string.empty': 'RSI handle is required',
        'string.min': 'RSI handle must be at least 3 characters',
        'string.max': 'RSI handle cannot exceed 60 characters',
        'string.pattern.base':
          'RSI handle can only contain letters, numbers, underscores and hyphens',
        'any.required': 'RSI handle is required',
      }),
  }),

  /**
   * Initiate RSI organization verification
   * Validates the organization ID and RSI organization SID
   */
  initiateOrgVerification: Joi.object({
    orgId: Joi.string().trim().required().messages({
      'string.empty': 'Organization ID is required',
      'any.required': 'Organization ID is required',
    }),
    rsiOrgSid: Joi.string()
      .trim()
      .min(1)
      .max(20)
      .pattern(/^[A-Z0-9_-]+$/i)
      .required()
      .messages({
        'string.empty': 'RSI organization SID is required',
        'string.min': 'RSI organization SID must be at least 1 character',
        'string.max': 'RSI organization SID cannot exceed 20 characters',
        'string.pattern.base':
          'RSI organization SID can only contain letters, numbers, underscores and hyphens',
        'any.required': 'RSI organization SID is required',
      }),
  }),

  /**
   * Complete RSI organization verification
   * Validates the organization ID
   */
  completeOrgVerification: Joi.object({
    orgId: Joi.string().trim().required().messages({
      'string.empty': 'Organization ID is required',
      'any.required': 'Organization ID is required',
    }),
  }),

  /**
   * Verify RSI organization by rank (no code required)
   * Validates the organization ID and RSI organization SID
   */
  verifyOrgByRank: Joi.object({
    orgId: Joi.string().trim().required().messages({
      'string.empty': 'Organization ID is required',
      'any.required': 'Organization ID is required',
    }),
    rsiOrgSid: Joi.string()
      .trim()
      .min(1)
      .max(20)
      .pattern(/^[A-Z0-9_-]+$/i)
      .required()
      .messages({
        'string.empty': 'RSI organization SID is required',
        'string.min': 'RSI organization SID must be at least 1 character',
        'string.max': 'RSI organization SID cannot exceed 20 characters',
        'string.pattern.base':
          'RSI organization SID can only contain letters, numbers, underscores and hyphens',
        'any.required': 'RSI organization SID is required',
      }),
  }),

  /**
   * Verify organization ownership
   * Validates the organization SID
   */
  verifyOrganization: Joi.object({
    orgSid: Joi.string()
      .trim()
      .min(1)
      .max(20)
      .pattern(/^[A-Z0-9_-]+$/i)
      .required()
      .messages({
        'string.empty': 'Organization SID is required',
        'string.min': 'Organization SID must be at least 1 character',
        'string.max': 'Organization SID cannot exceed 20 characters',
        'string.pattern.base':
          'Organization SID can only contain letters, numbers, underscores and hyphens',
        'any.required': 'Organization SID is required',
      }),
  }),

  /**
   * Lookup RSI user (for params validation if needed)
   */
  lookupUser: Joi.object({
    handle: Joi.string()
      .trim()
      .min(3)
      .max(60)
      .pattern(/^[a-zA-Z0-9_-]+$/)
      .required()
      .messages({
        'string.empty': 'RSI handle is required',
        'string.min': 'RSI handle must be at least 3 characters',
        'string.max': 'RSI handle cannot exceed 60 characters',
        'string.pattern.base':
          'RSI handle can only contain letters, numbers, underscores and hyphens',
        'any.required': 'RSI handle is required',
      }),
  }),

  /**
   * Lookup RSI organization (for params validation if needed)
   */
  lookupOrganization: Joi.object({
    sid: Joi.string()
      .trim()
      .min(1)
      .max(20)
      .pattern(/^[A-Z0-9_-]+$/i)
      .required()
      .messages({
        'string.empty': 'Organization SID is required',
        'string.min': 'Organization SID must be at least 1 character',
        'string.max': 'Organization SID cannot exceed 20 characters',
        'string.pattern.base':
          'Organization SID can only contain letters, numbers, underscores and hyphens',
        'any.required': 'Organization SID is required',
      }),
  }),
};
