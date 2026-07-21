import Joi from 'joi';

import { description, id, notes, paginationKeys } from './common';

/**
 * Trading validation schemas
 */

export const tradingSchemas = {
  // Create trading route
  createRoute: Joi.object({
    name: Joi.string().trim().min(1).max(200).required(),
    description,
    stops: Joi.array()
      .items(
        Joi.object({
          location: Joi.string().trim().required(),
          order: Joi.number().integer().min(0).required(),
          commodities: Joi.array()
            .items(
              Joi.object({
                name: Joi.string().trim().required(),
                action: Joi.string().valid('buy', 'sell').required(),
                quantity: Joi.number().integer().min(1).optional(),
                price: Joi.number().min(0).optional(),
              })
            )
            .optional(),
        })
      )
      .min(2)
      .required(),
    estimatedProfit: Joi.number().min(0).optional(),
    estimatedDuration: Joi.number().integer().min(0).optional(), // minutes
    minCargoCapacity: Joi.number().integer().min(0).optional(),
    tags: Joi.array().items(Joi.string().trim()).optional(),
    notes,
  }),

  // Update trading route
  updateRoute: Joi.object({
    name: Joi.string().trim().min(1).max(200).optional(),
    description,
    stops: Joi.array()
      .items(
        Joi.object({
          location: Joi.string().trim().required(),
          order: Joi.number().integer().min(0).required(),
        })
      )
      .min(2)
      .optional(),
    estimatedProfit: Joi.number().min(0).optional(),
    estimatedDuration: Joi.number().integer().min(0).optional(),
    status: Joi.string().valid('active', 'inactive', 'deprecated').optional(),
    tags: Joi.array().items(Joi.string().trim()).optional(),
    notes,
  }),

  // Update performance
  updatePerformance: Joi.object({
    actualProfit: Joi.number().required(),
    actualDuration: Joi.number().integer().min(0).optional(),
    notes,
  }),

  // Update status
  updateStatus: Joi.object({
    status: Joi.string().valid('active', 'inactive', 'deprecated').required(),
  }),

  // Query filters
  query: Joi.object({
    ...paginationKeys,
    status: Joi.string().valid('active', 'inactive', 'deprecated').optional(),
    minProfit: Joi.number().min(0).optional(),
    maxDuration: Joi.number().integer().min(0).optional(),
    tags: Joi.array().items(Joi.string().trim()).optional(),
  }),

  // Route ID param
  param: Joi.object({
    id,
  }),

  updateRoutePerformance: Joi.object({
    profit: Joi.number().optional(),
    trades: Joi.number().integer().min(0).optional(),
    efficiency: Joi.number().min(0).max(100).optional(),
    notes: Joi.string().max(500).optional(),
  }),

  updateRouteStatus: Joi.object({
    status: Joi.string().valid('planned', 'active', 'completed', 'cancelled').required(),
    notes: Joi.string().max(500).optional(),
  }),

  // Record completion
  recordCompletion: Joi.object({
    profit: Joi.number().required(),
    duration: Joi.number().integer().min(1).required(), // minutes
  }),

  // Generate route
  generateRoute: Joi.object({
    startLocation: Joi.string().trim().required(),
    cargoCapacity: Joi.number().integer().min(1).required(),
    maxStops: Joi.number().integer().min(2).max(10).optional(),
    minProfitMargin: Joi.number().min(0).max(100).optional(),
    avoidLocations: Joi.array().items(Joi.string().trim()).optional(),
    preferredCommodities: Joi.array().items(Joi.string().trim()).optional(),
  }),

  // Create price alert
  createPriceAlert: Joi.object({
    commodity: Joi.string().trim().min(1).max(255).required(),
    location: Joi.string().trim().max(255).optional(),
    condition: Joi.string().valid('above', 'below', 'change_percent').required(),
    threshold: Joi.number().positive().required(),
    enabled: Joi.boolean().optional(),
  }),

  // Update price alert
  updatePriceAlert: Joi.object({
    commodity: Joi.string().trim().min(1).max(255).optional(),
    location: Joi.string().trim().max(255).optional().allow(null),
    condition: Joi.string().valid('above', 'below', 'change_percent').optional(),
    threshold: Joi.number().positive().optional(),
    enabled: Joi.boolean().optional(),
  }),

  // Price alert ID param
  alertParam: Joi.object({
    id,
  }),

  // Execute a trade run along an existing route
  executeTradeRun: Joi.object({
    shipId: Joi.string().trim().optional(),
    actualBuyPrice: Joi.number().min(0).optional(),
    actualSellPrice: Joi.number().min(0).optional(),
    quantityTraded: Joi.number().integer().min(1).optional(),
    notes,
  }),

  // Create a complete trade operation (route + alerts + suppliers)
  createTradeOperation: Joi.object({
    operationData: Joi.object({
      name: Joi.string().trim().min(1).max(200).required(),
      description,
      stops: Joi.array()
        .items(
          Joi.object({
            location: Joi.string().trim().required(),
            order: Joi.number().integer().min(0).required(),
            commodities: Joi.array()
              .items(
                Joi.object({
                  name: Joi.string().trim().required(),
                  action: Joi.string().valid('buy', 'sell').required(),
                  quantity: Joi.number().integer().min(1).optional(),
                  price: Joi.number().min(0).optional(),
                })
              )
              .optional(),
          })
        )
        .min(2)
        .required(),
      commodities: Joi.array()
        .items(
          Joi.object({
            name: Joi.string().trim().required(),
            quantity: Joi.number().integer().min(1).required(),
            buyPrice: Joi.number().min(0).optional(),
            sellPrice: Joi.number().min(0).optional(),
          })
        )
        .optional(),
      estimatedProfit: Joi.number().min(0).optional(),
    }).required(),
    routeOptions: Joi.object({
      optimizeForFuel: Joi.boolean().optional(),
      maxStops: Joi.number().integer().min(2).max(10).optional(),
      preferredRefuelStops: Joi.array().items(Joi.string().trim()).optional(),
    }).optional(),
    alertsConfig: Joi.object({
      priceThresholds: Joi.array()
        .items(
          Joi.object({
            commodityName: Joi.string().trim().required(),
            minPrice: Joi.number().min(0).optional(),
            maxPrice: Joi.number().min(0).optional(),
          })
        )
        .optional(),
      inventoryAlerts: Joi.boolean().optional(),
    }).optional(),
    supplierIds: Joi.array().items(Joi.string().trim()).optional(),
    notifyParticipants: Joi.boolean().default(true),
    postToDiscord: Joi.boolean().default(false),
    discordChannelId: Joi.string().trim().optional(),
  }),

  // List trade disputes query
  listDisputes: Joi.object({
    ...paginationKeys,
    status: Joi.string().valid('open', 'closed').optional(),
    transactionId: Joi.string().uuid().optional(),
  }),

  // Create trade dispute
  createDispute: Joi.object({
    transactionId: Joi.string().uuid().required(),
    reason: Joi.string().trim().min(10).max(5000).required(),
    requestedResolution: Joi.string().trim().max(2000).optional(),
    evidenceLinks: Joi.array().items(Joi.string().uri()).max(20).optional(),
    amountInDispute: Joi.number().min(0).optional(),
  }),

  // Resolve trade dispute
  resolveDispute: Joi.object({
    resolution: Joi.string().trim().min(10).max(5000).required(),
    closeTicket: Joi.boolean().default(true),
  }),
};
