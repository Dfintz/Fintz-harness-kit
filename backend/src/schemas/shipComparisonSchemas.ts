import Joi from 'joi';

export const shipComparisonSchemas = {
  compareBody: Joi.object({
    shipIds: Joi.array().items(Joi.string().trim().required()).min(2).max(8).required(),
  }).unknown(false),

  quickCompareBody: Joi.object({
    shipId1: Joi.string().trim().required(),
    shipId2: Joi.string().trim().required(),
  }).unknown(false),

  shipIdParam: Joi.object({
    id: Joi.string().trim().required(),
  }).unknown(false),

  fleetIdParam: Joi.object({
    id: Joi.string().trim().required(),
  }).unknown(false),

  similarShipsQuery: Joi.object({
    limit: Joi.number().integer().min(1).max(20).default(5),
  }).unknown(false),
};
