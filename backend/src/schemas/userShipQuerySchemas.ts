import Joi from 'joi';

import { ShipCondition, ShipOwnershipStatus, ShipSharingLevel } from '../models/UserShip';

import { pagination } from './common';

const statusValues = Object.values(ShipOwnershipStatus);
const conditionValues = Object.values(ShipCondition);
const sharingLevelValues = Object.values(ShipSharingLevel);

const stringToArray = (allowed: readonly string[]) =>
  Joi.alternatives()
    .try(
      Joi.array()
        .items(Joi.string().valid(...allowed))
        .unique(),
      Joi.string().custom((value, helpers) => {
        if (typeof value !== 'string') {
          return helpers.error('any.invalid');
        }
        const items = value
          .split(',')
          .map(v => v.trim())
          .filter(Boolean);

        const { error, value: validated } = Joi.array()
          .items(Joi.string().valid(...allowed))
          .unique()
          .validate(items, { convert: true });

        if (error) {
          return helpers.error('any.invalid');
        }

        return validated;
      })
    )
    .optional();

export const userShipQuerySchemas = {
  listQuery: pagination.keys({
    shipId: Joi.string().trim().optional(),
    status: stringToArray(statusValues),
    condition: stringToArray(conditionValues),
    location: Joi.string().trim().optional(),
    search: Joi.string().trim().max(200).optional(),
    tags: stringToArray([]),
    isLoaned: Joi.boolean().optional(),
    sharingLevel: stringToArray(sharingLevelValues),
    sortBy: Joi.string().valid('shipName', 'createdAt', 'updatedAt', 'status').default('createdAt'),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
  }),

  userIdParam: Joi.object({
    userId: Joi.string().trim().required(),
  }),

  shipIdParam: Joi.object({
    shipId: Joi.string().trim().required(),
  }),

  /** Combined param schema for routes with both :userId and :shipId */
  userShipParam: Joi.object({
    userId: Joi.string().trim().required(),
    shipId: Joi.string().trim().required(),
  }),

  createShip: Joi.object({
    shipId: Joi.string().trim().optional(),
    shipName: Joi.string().trim().min(1).max(200).required(),
    manufacturer: Joi.string().trim().max(200).optional(),
    model: Joi.string().trim().max(200).optional(),
    variant: Joi.string().trim().max(200).optional(),
    pledgeDate: Joi.date().iso().optional(),
    purchasePrice: Joi.number().min(0).optional(),
    customName: Joi.string().trim().max(200).optional(),
    location: Joi.string().trim().max(200).optional(),
    condition: Joi.string()
      .valid(...conditionValues)
      .optional(),
    status: Joi.string()
      .valid(...statusValues)
      .optional(),
    sharingLevel: Joi.string()
      .valid(...sharingLevelValues)
      .optional(),
    tags: Joi.array().items(Joi.string().trim()).optional(),
    insuranceLevel: Joi.string().trim().max(100).optional(),
    insuranceProvider: Joi.string().trim().max(100).optional(),
    insurancePolicyId: Joi.string().trim().max(100).optional(),
    insuranceExpiryDate: Joi.date().iso().optional(),
    description: Joi.string().trim().max(2000).allow('').optional(),
    notes: Joi.string().trim().max(1000).optional(),
    metadata: Joi.object().unknown(true).optional(),
  }),

  updateShip: Joi.object({
    customName: Joi.string().trim().max(200).allow('').optional(),
    location: Joi.string().trim().max(200).allow('').optional(),
    condition: Joi.string()
      .valid(...conditionValues)
      .optional(),
    status: Joi.string()
      .valid(...statusValues)
      .optional(),
    sharingLevel: Joi.string()
      .valid(...sharingLevelValues)
      .optional(),
    sharedWithUsers: Joi.array().items(Joi.string().trim().max(100)).optional(),
    tags: Joi.array().items(Joi.string().trim()).optional(),
    insuranceLevel: Joi.string().trim().max(100).optional(),
    insuranceProvider: Joi.string().trim().max(100).optional(),
    insurancePolicyId: Joi.string().trim().max(100).optional(),
    insuranceExpiryDate: Joi.date().iso().optional(),
    erkulLoadoutUrl: Joi.string()
      .trim()
      .uri({ scheme: ['https'] })
      .max(500)
      .allow('')
      .optional(),
    description: Joi.string().trim().max(2000).allow('').optional(),
    notes: Joi.string().trim().max(1000).optional(),
  }),

  loanShip: Joi.object({
    scope: Joi.string().valid('organization', 'alliance').required(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    purpose: Joi.string().trim().max(500).optional(),
    notes: Joi.string().trim().max(1000).optional(),
    activityId: Joi.string().trim().max(100).optional(),
    activityName: Joi.string().trim().max(200).optional(),
  }),
};
