import Joi from 'joi';

/**
 * Dead-letter queue validation schemas.
 */
export const paramSchemas = {
  entryId: Joi.object({
    id: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid dead-letter entry ID format',
      'any.required': 'Dead-letter entry ID is required',
    }),
  }),
};
