import Joi from 'joi';

/**
 * Validation schemas for aggregator service endpoints.
 * These schemas validate the parameters for complex multi-service operations
 * handled by Activity, Fleet, and Trade aggregator services.
 */

// ============================================================
// Activity Aggregator Schemas
// ============================================================

export const createActivityWithParticipantsSchema = Joi.object({
  organizationId: Joi.string().uuid().required(),
  activityData: Joi.object({
    title: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(2000).optional(),
    activityType: Joi.string().min(1).max(100).required(),
    scheduledStartDate: Joi.date().iso().required(),
    scheduledEndDate: Joi.date().iso().greater(Joi.ref('scheduledStartDate')).optional(),
    maxParticipants: Joi.number().integer().min(1).max(1000).optional(),
    creatorId: Joi.string().uuid().required(),
  }).required(),
  participantIds: Joi.array().items(Joi.string().uuid()).max(1000).optional(),
  notifyParticipants: Joi.boolean().default(false),
  postToDiscord: Joi.boolean().default(false),
  discordChannelId: Joi.string().optional(),
});

export const completeActivitySchema = Joi.object({
  organizationId: Joi.string().uuid().required(),
  activityId: Joi.string().uuid().required(),
  completedById: Joi.string().uuid().required(),
  outcome: Joi.string().valid('success', 'failed', 'cancelled').default('success'),
  summary: Joi.string().max(2000).optional(),
  participantReports: Joi.array()
    .items(
      Joi.object({
        userId: Joi.string().uuid().required(),
        attended: Joi.boolean().required(),
        contribution: Joi.string().max(500).optional(),
      })
    )
    .optional(),
  notifyParticipants: Joi.boolean().default(false),
});

export const cancelActivitySchema = Joi.object({
  organizationId: Joi.string().uuid().required(),
  activityId: Joi.string().uuid().required(),
  cancelledById: Joi.string().uuid().required(),
  reason: Joi.string().max(500).optional(),
  notifyParticipants: Joi.boolean().default(true),
});

export const getActivityDetailsSchema = Joi.object({
  organizationId: Joi.string().uuid().required(),
  activityId: Joi.string().uuid().required(),
});

// ============================================================
// Fleet Aggregator Schemas
// ============================================================

export const createFleetWithAssetsSchema = Joi.object({
  organizationId: Joi.string().uuid().required(),
  fleetData: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(2000).optional(),
    status: Joi.string().optional(),
    // Team/Squad assignment (Phase 1.2)
    teamId: Joi.string().uuid().allow(null).optional(),
  }).required(),
  shipIds: Joi.array().items(Joi.string().uuid()).optional(),
  squadronData: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    leaderId: Joi.string().uuid().required(),
    memberIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
  }).optional(),
  inventoryItems: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().min(1).max(255).required(),
        category: Joi.string().required(),
        quantity: Joi.number().integer().min(0).required(),
        unit: Joi.string().required(),
      })
    )
    .optional(),
  notifyMembers: Joi.boolean().default(false),
  postToDiscord: Joi.boolean().default(false),
  discordChannelId: Joi.string().optional(),
});

export const deployFleetSchema = Joi.object({
  organizationId: Joi.string().uuid().required(),
  fleetId: Joi.string().uuid().required(),
  deploymentData: Joi.object({
    location: Joi.string().min(1).max(255).required(),
    mission: Joi.string().min(1).max(255).required(),
    objectives: Joi.array().items(Joi.string().max(500)).optional(),
    estimatedDuration: Joi.string().max(100).optional(),
  }).required(),
  notifyMembers: Joi.boolean().default(false),
});

export const dissolveFleetSchema = Joi.object({
  organizationId: Joi.string().uuid().required(),
  fleetId: Joi.string().uuid().required(),
  dissolvedById: Joi.string().uuid().required(),
  reason: Joi.string().max(500).optional(),
  notifyMembers: Joi.boolean().default(false),
});

export const analyzeFleetCompositionSchema = Joi.object({
  organizationId: Joi.string().uuid().required(),
  fleetId: Joi.string().uuid().required(),
});

// ============================================================
// Trade Aggregator Schemas
// ============================================================

export const createTradeOperationSchema = Joi.object({
  organizationId: Joi.string().uuid().required(),
  operationData: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    coordinatorId: Joi.string().uuid().required(),
    route: Joi.object({
      name: Joi.string().min(1).max(255).required(),
      stops: Joi.array()
        .items(
          Joi.object({
            location: Joi.string().min(1).max(255).required(),
            type: Joi.string().valid('buy', 'sell', 'waypoint').required(),
            commodity: Joi.string().optional(),
            quantity: Joi.number().integer().min(0).optional(),
            price: Joi.number().min(0).optional(),
          })
        )
        .min(2)
        .required(),
    }).required(),
  }).required(),
  notifyParticipants: Joi.boolean().default(false),
  postToDiscord: Joi.boolean().default(false),
  discordChannelId: Joi.string().optional(),
});

export const analyzeSupplyChainSchema = Joi.object({
  organizationId: Joi.string().uuid().required(),
  commodities: Joi.array().items(Joi.string().min(1).max(100)).min(1).max(50).required(),
  startLocation: Joi.string().min(1).max(255).required(),
  endLocation: Joi.string().min(1).max(255).optional(),
  budget: Joi.number().min(0).optional(),
  includeSuppliers: Joi.boolean().default(false),
});

export const batchUpdateRouteStatusSchema = Joi.object({
  organizationId: Joi.string().uuid().required(),
  routeIds: Joi.array().items(Joi.string().uuid()).min(1).max(100).required(),
  newStatus: Joi.string().required(),
  updatedById: Joi.string().uuid().required(),
  reason: Joi.string().max(500).optional(),
});

/**
 * Aggregator schemas namespace for organized access
 */
export const aggregatorSchemas = {
  // Activity
  createActivityWithParticipants: createActivityWithParticipantsSchema,
  completeActivity: completeActivitySchema,
  cancelActivity: cancelActivitySchema,
  getActivityDetails: getActivityDetailsSchema,
  // Fleet
  createFleetWithAssets: createFleetWithAssetsSchema,
  deployFleet: deployFleetSchema,
  dissolveFleet: dissolveFleetSchema,
  analyzeFleetComposition: analyzeFleetCompositionSchema,
  // Trade
  createTradeOperation: createTradeOperationSchema,
  analyzeSupplyChain: analyzeSupplyChainSchema,
  batchUpdateRouteStatus: batchUpdateRouteStatusSchema,
};
