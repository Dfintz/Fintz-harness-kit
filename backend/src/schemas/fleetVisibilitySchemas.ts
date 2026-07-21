import Joi from 'joi';

/**
 * Joi validation schemas for fleet visibility rules.
 */
export const fleetVisibilitySchemas = {
  /** Create a new visibility rule */
  createRule: Joi.object({
    scope: Joi.string()
      .valid('organization', 'alliance', 'federation')
      .required()
      .description('Visibility scope type'),
    accessLevel: Joi.string()
      .valid('summary', 'composition', 'full')
      .required()
      .description('Level of detail to expose'),
    minSecurityLevel: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .when('scope', {
        is: 'organization',
        then: Joi.required(),
        otherwise: Joi.forbidden(),
      })
      .description('Minimum member security level (rank) for organization scope'),
    targetAllianceOrgId: Joi.string()
      .uuid()
      .when('scope', {
        is: 'alliance',
        then: Joi.required(),
        otherwise: Joi.forbidden(),
      })
      .description('Target allied org ID for alliance scope'),
    targetFederationId: Joi.string()
      .uuid()
      .when('scope', {
        is: 'federation',
        then: Joi.required(),
        otherwise: Joi.forbidden(),
      })
      .description('Target federation ID for federation scope'),
  }),

  /** Update a visibility rule */
  updateRule: Joi.object({
    accessLevel: Joi.string()
      .valid('summary', 'composition', 'full')
      .description('Level of detail to expose'),
    minSecurityLevel: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .description('Minimum security level (only for organization scope)'),
    isActive: Joi.boolean().description('Whether the rule is active'),
  }).min(1),

  /** Check access request body */
  checkAccess: Joi.object({
    targetOrgId: Joi.string()
      .uuid()
      .optional()
      .description('Organization requesting access (defaults to caller org)'),
  }),

  /** Route param for rule ID */
  ruleParam: Joi.object({
    id: Joi.string().uuid().required(),
    ruleId: Joi.string().uuid().required(),
  }),

  /** Route param for fleet ID */
  fleetParam: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};
