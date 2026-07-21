import Joi from 'joi';

const validTypes = ['organization', 'federation', 'user'];

export const globalSearchSchemas = {
  /** Validation schema for GET /api/v2/search/global query parameters */
  searchQuery: Joi.object({
    q: Joi.string().min(2).max(100).required()
      .messages({
        'string.min': 'Search query must be at least 2 characters',
        'string.max': 'Search query must not exceed 100 characters',
        'any.required': 'Search query (q) is required',
      }),
    types: Joi.string().optional()
      .custom((value: string) => {
        const parsed = value.split(',').map((v: string) => v.trim());
        for (const t of parsed) {
          if (!validTypes.includes(t)) {
            throw new Error(`Invalid type: ${t}. Allowed: ${validTypes.join(', ')}`);
          }
        }
        return parsed;
      }),
    limit: Joi.number().integer().min(1).max(20).default(5).optional(),
  }),
};
