import Joi from 'joi';

import { pagination } from './common';

/**
 * Import validation schemas (v2)
 */

const importSource = Joi.string().valid('scstats_json', 'scstats_csv', 'generic_csv').required();

export const importSchemas = {
  create: Joi.object({
    source: importSource.default('scstats_json'),
    jsonData: Joi.when('source', {
      is: 'scstats_json',
      then: Joi.string().trim().min(2).max(10_000_000).required(),
      otherwise: Joi.forbidden(),
    }),
    csvData: Joi.when('source', {
      is: 'generic_csv',
      then: Joi.string().trim().min(2).max(10_000_000).optional(),
      otherwise: Joi.forbidden(),
    }),
    consentGranted: Joi.boolean().valid(true).required().messages({
      'any.only': 'Consent must be granted for data import (GDPR Article 6)',
    }),
  }),

  validate: Joi.object({
    source: importSource.default('scstats_json'),
    jsonData: Joi.when('source', {
      is: 'scstats_json',
      then: Joi.string().trim().min(2).max(10_000_000).required(),
      otherwise: Joi.forbidden(),
    }),
    csvData: Joi.when('source', {
      is: 'generic_csv',
      then: Joi.string().trim().min(2).max(10_000_000).required(),
      otherwise: Joi.forbidden(),
    }),
  }),

  query: pagination,
};
