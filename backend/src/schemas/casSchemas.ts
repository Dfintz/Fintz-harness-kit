import Joi from 'joi';

export const casSchemas = {
  getScore: Joi.object({
    orgId: Joi.string().uuid().required(),
  }),

  getHistory: Joi.object({
    days: Joi.number().integer().min(1).max(90).default(30),
  }),

  getHeatmap: Joi.object({
    days: Joi.number().integer().min(1).max(30).default(7),
    logScale: Joi.boolean().default(true),
  }),

  getRanking: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};
