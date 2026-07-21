import Joi from 'joi';

import { IntegrationStatus } from '../models/ExternalIntegration';

const SHARE_TARGET_TYPES = ['federation', 'organization'] as const;

const starCommsSharingSchema = Joi.object({
  enabled: Joi.boolean().required(),
  whitelist: Joi.array()
    .items(
      Joi.object({
        type: Joi.string()
          .valid(...SHARE_TARGET_TYPES)
          .required(),
        targetId: Joi.alternatives()
          .conditional('type', {
            is: 'federation',
            then: Joi.string().uuid().required(),
            otherwise: Joi.string().trim().min(1).max(100).required(),
          })
          .required(),
        targetName: Joi.string().trim().max(200).optional(),
      })
    )
    .max(50)
    .default([]),
});

const starCommsConfigSchema = Joi.object({
  baseUrl: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  shardId: Joi.string().trim().max(120).optional(),
  metricsWindowMinutes: Joi.number().integer().min(1).max(1440).optional(),
  keyReferenceId: Joi.string().trim().max(200).optional(),
  featureFlags: Joi.object().pattern(Joi.string().trim().min(1), Joi.boolean()).optional(),
  requiredPermission: Joi.string().trim().max(200).optional(),
  minRolePriority: Joi.number().integer().min(0).max(1000).optional(),
  sharing: starCommsSharingSchema.optional(),
});

export const starCommsSchemas = {
  federationIdParam: Joi.object({
    federationId: Joi.string().uuid().required(),
  }),

  updateFederationConfigBody: Joi.object({
    fleetId: Joi.string().uuid().optional(),
    name: Joi.string().trim().min(1).max(200).optional(),
    status: Joi.string()
      .valid(...Object.values(IntegrationStatus))
      .optional(),
    enabled: Joi.boolean().optional(),
    starCommsConfig: starCommsConfigSchema.required(),
  }).min(1),
};
