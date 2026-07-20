"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tradingSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.tradingSchemas = {
    createRoute: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).required(),
        description: common_1.description,
        stops: joi_1.default.array()
            .items(joi_1.default.object({
            location: joi_1.default.string().trim().required(),
            order: joi_1.default.number().integer().min(0).required(),
            commodities: joi_1.default.array()
                .items(joi_1.default.object({
                name: joi_1.default.string().trim().required(),
                action: joi_1.default.string().valid('buy', 'sell').required(),
                quantity: joi_1.default.number().integer().min(1).optional(),
                price: joi_1.default.number().min(0).optional(),
            }))
                .optional(),
        }))
            .min(2)
            .required(),
        estimatedProfit: joi_1.default.number().min(0).optional(),
        estimatedDuration: joi_1.default.number().integer().min(0).optional(),
        minCargoCapacity: joi_1.default.number().integer().min(0).optional(),
        tags: joi_1.default.array().items(joi_1.default.string().trim()).optional(),
        notes: common_1.notes,
    }),
    updateRoute: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).optional(),
        description: common_1.description,
        stops: joi_1.default.array()
            .items(joi_1.default.object({
            location: joi_1.default.string().trim().required(),
            order: joi_1.default.number().integer().min(0).required(),
        }))
            .min(2)
            .optional(),
        estimatedProfit: joi_1.default.number().min(0).optional(),
        estimatedDuration: joi_1.default.number().integer().min(0).optional(),
        status: joi_1.default.string().valid('active', 'inactive', 'deprecated').optional(),
        tags: joi_1.default.array().items(joi_1.default.string().trim()).optional(),
        notes: common_1.notes,
    }),
    updatePerformance: joi_1.default.object({
        actualProfit: joi_1.default.number().required(),
        actualDuration: joi_1.default.number().integer().min(0).optional(),
        notes: common_1.notes,
    }),
    updateStatus: joi_1.default.object({
        status: joi_1.default.string().valid('active', 'inactive', 'deprecated').required(),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        status: joi_1.default.string().valid('active', 'inactive', 'deprecated').optional(),
        minProfit: joi_1.default.number().min(0).optional(),
        maxDuration: joi_1.default.number().integer().min(0).optional(),
        tags: joi_1.default.array().items(joi_1.default.string().trim()).optional(),
    }),
    param: joi_1.default.object({
        id: common_1.id,
    }),
    updateRoutePerformance: joi_1.default.object({
        profit: joi_1.default.number().optional(),
        trades: joi_1.default.number().integer().min(0).optional(),
        efficiency: joi_1.default.number().min(0).max(100).optional(),
        notes: joi_1.default.string().max(500).optional(),
    }),
    updateRouteStatus: joi_1.default.object({
        status: joi_1.default.string().valid('planned', 'active', 'completed', 'cancelled').required(),
        notes: joi_1.default.string().max(500).optional(),
    }),
    recordCompletion: joi_1.default.object({
        profit: joi_1.default.number().required(),
        duration: joi_1.default.number().integer().min(1).required(),
    }),
    generateRoute: joi_1.default.object({
        startLocation: joi_1.default.string().trim().required(),
        cargoCapacity: joi_1.default.number().integer().min(1).required(),
        maxStops: joi_1.default.number().integer().min(2).max(10).optional(),
        minProfitMargin: joi_1.default.number().min(0).max(100).optional(),
        avoidLocations: joi_1.default.array().items(joi_1.default.string().trim()).optional(),
        preferredCommodities: joi_1.default.array().items(joi_1.default.string().trim()).optional(),
    }),
    createPriceAlert: joi_1.default.object({
        commodity: joi_1.default.string().trim().min(1).max(255).required(),
        location: joi_1.default.string().trim().max(255).optional(),
        condition: joi_1.default.string().valid('above', 'below', 'change_percent').required(),
        threshold: joi_1.default.number().positive().required(),
        enabled: joi_1.default.boolean().optional(),
    }),
    updatePriceAlert: joi_1.default.object({
        commodity: joi_1.default.string().trim().min(1).max(255).optional(),
        location: joi_1.default.string().trim().max(255).optional().allow(null),
        condition: joi_1.default.string().valid('above', 'below', 'change_percent').optional(),
        threshold: joi_1.default.number().positive().optional(),
        enabled: joi_1.default.boolean().optional(),
    }),
    alertParam: joi_1.default.object({
        id: common_1.id,
    }),
    executeTradeRun: joi_1.default.object({
        shipId: joi_1.default.string().trim().optional(),
        actualBuyPrice: joi_1.default.number().min(0).optional(),
        actualSellPrice: joi_1.default.number().min(0).optional(),
        quantityTraded: joi_1.default.number().integer().min(1).optional(),
        notes: common_1.notes,
    }),
    createTradeOperation: joi_1.default.object({
        operationData: joi_1.default.object({
            name: joi_1.default.string().trim().min(1).max(200).required(),
            description: common_1.description,
            stops: joi_1.default.array()
                .items(joi_1.default.object({
                location: joi_1.default.string().trim().required(),
                order: joi_1.default.number().integer().min(0).required(),
                commodities: joi_1.default.array()
                    .items(joi_1.default.object({
                    name: joi_1.default.string().trim().required(),
                    action: joi_1.default.string().valid('buy', 'sell').required(),
                    quantity: joi_1.default.number().integer().min(1).optional(),
                    price: joi_1.default.number().min(0).optional(),
                }))
                    .optional(),
            }))
                .min(2)
                .required(),
            commodities: joi_1.default.array()
                .items(joi_1.default.object({
                name: joi_1.default.string().trim().required(),
                quantity: joi_1.default.number().integer().min(1).required(),
                buyPrice: joi_1.default.number().min(0).optional(),
                sellPrice: joi_1.default.number().min(0).optional(),
            }))
                .optional(),
            estimatedProfit: joi_1.default.number().min(0).optional(),
        }).required(),
        routeOptions: joi_1.default.object({
            optimizeForFuel: joi_1.default.boolean().optional(),
            maxStops: joi_1.default.number().integer().min(2).max(10).optional(),
            preferredRefuelStops: joi_1.default.array().items(joi_1.default.string().trim()).optional(),
        }).optional(),
        alertsConfig: joi_1.default.object({
            priceThresholds: joi_1.default.array()
                .items(joi_1.default.object({
                commodityName: joi_1.default.string().trim().required(),
                minPrice: joi_1.default.number().min(0).optional(),
                maxPrice: joi_1.default.number().min(0).optional(),
            }))
                .optional(),
            inventoryAlerts: joi_1.default.boolean().optional(),
        }).optional(),
        supplierIds: joi_1.default.array().items(joi_1.default.string().trim()).optional(),
        notifyParticipants: joi_1.default.boolean().default(true),
        postToDiscord: joi_1.default.boolean().default(false),
        discordChannelId: joi_1.default.string().trim().optional(),
    }),
    listDisputes: joi_1.default.object({
        ...common_1.paginationKeys,
        status: joi_1.default.string().valid('open', 'closed').optional(),
        transactionId: joi_1.default.string().uuid().optional(),
    }),
    createDispute: joi_1.default.object({
        transactionId: joi_1.default.string().uuid().required(),
        reason: joi_1.default.string().trim().min(10).max(5000).required(),
        requestedResolution: joi_1.default.string().trim().max(2000).optional(),
        evidenceLinks: joi_1.default.array().items(joi_1.default.string().uri()).max(20).optional(),
        amountInDispute: joi_1.default.number().min(0).optional(),
    }),
    resolveDispute: joi_1.default.object({
        resolution: joi_1.default.string().trim().min(10).max(5000).required(),
        closeTicket: joi_1.default.boolean().default(true),
    }),
};
//# sourceMappingURL=tradingSchemas.js.map