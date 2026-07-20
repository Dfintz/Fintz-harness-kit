"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fleetSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.fleetSchemas = {
    singleMember: joi_1.default.object({
        fleetId: common_1.id.required(),
        userId: common_1.id,
        role: joi_1.default.string().trim().max(50).optional(),
        shipType: joi_1.default.string().trim().max(100).optional(),
        status: joi_1.default.string().valid('active', 'inactive', 'on_leave', 'deployed').optional(),
    }),
    bulkAddMembers: joi_1.default.object({
        members: joi_1.default.array()
            .items(joi_1.default.object({
            userId: common_1.id,
            role: joi_1.default.string().trim().max(50).optional(),
            shipType: joi_1.default.string().trim().max(100).optional(),
            status: joi_1.default.string()
                .valid('active', 'inactive', 'on_leave', 'deployed')
                .default('active'),
        }))
            .min(1)
            .max(100)
            .required(),
    }),
    bulkUpdateMembers: joi_1.default.object({
        updates: joi_1.default.array()
            .items(joi_1.default.object({
            id: common_1.id,
            data: joi_1.default.object({
                role: joi_1.default.string().trim().max(50).optional(),
                shipType: joi_1.default.string().trim().max(100).optional(),
                status: joi_1.default.string().valid('active', 'inactive', 'on_leave', 'deployed').optional(),
            }).required(),
        }))
            .min(1)
            .max(100)
            .required(),
    }),
    bulkDeleteMembers: joi_1.default.object({
        memberIds: common_1.idArray,
    }),
    bulkUpdateStatus: joi_1.default.object({
        memberIds: common_1.idArray,
        status: joi_1.default.string().valid('active', 'inactive', 'on_leave', 'deployed').required(),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        fleetId: joi_1.default.string().trim().optional(),
        role: joi_1.default.string().trim().optional(),
        shipType: joi_1.default.string().trim().optional(),
        status: joi_1.default.string().valid('active', 'inactive', 'on_leave', 'deployed').optional(),
    }),
    compareFleets: joi_1.default.object({
        fleetIds: joi_1.default.array().items(common_1.id).min(2).max(10).required(),
    }),
    param: joi_1.default.object({
        fleetId: common_1.id,
    }),
    analyticsQuery: joi_1.default.object({
        days: joi_1.default.number().integer().min(1).max(365).default(30),
    }),
    uploadCSV: joi_1.default.object({
        file: joi_1.default.any().required(),
        organizationId: common_1.id.optional(),
    }),
    memberId: joi_1.default.object({
        memberId: common_1.id.required(),
    }),
    updateMember: joi_1.default.object({
        role: joi_1.default.string().optional(),
        status: joi_1.default.string().valid('active', 'inactive', 'on_leave', 'deployed').optional(),
        notes: joi_1.default.string().max(500).optional(),
    }),
    analyticsWithDays: joi_1.default.object({
        days: joi_1.default.number().integer().min(1).max(365).default(30),
    }),
    moveFleet: joi_1.default.object({
        parentFleetId: joi_1.default.string().trim().max(100).allow(null).required(),
    }),
    reorderFleets: joi_1.default.object({
        orderedIds: joi_1.default.array().items(common_1.id).min(1).max(100).required(),
        parentFleetId: joi_1.default.string().trim().max(100).allow(null).optional(),
    }),
    deployFleet: joi_1.default.object({
        location: joi_1.default.string().trim().min(1).max(255).required(),
        mission: joi_1.default.string().trim().max(500).optional(),
        objectives: joi_1.default.array().items(joi_1.default.string().trim().max(255)).max(20).optional(),
        estimatedDuration: joi_1.default.number().integer().positive().optional(),
        notifyMembers: joi_1.default.boolean().default(true),
    }),
    dissolveFleet: joi_1.default.object({
        reason: joi_1.default.string().trim().max(500).optional(),
        reassignShipsToFleetId: joi_1.default.string().trim().max(100).optional().allow(null),
        notifyMembers: joi_1.default.boolean().default(true),
    }),
    createFleet: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(100).required(),
        description: joi_1.default.string().trim().max(500).optional(),
        type: joi_1.default.string()
            .valid('combat', 'mining', 'trading', 'exploration', 'salvage', 'escort', 'reconnaissance', 'medical', 'mixed')
            .optional(),
        members: joi_1.default.array().items(joi_1.default.string().trim()).max(100).optional(),
        emblem: joi_1.default.string().uri().trim().max(500).allow('', null).optional(),
    }),
    createFleetWithAssets: joi_1.default.object({
        fleetData: joi_1.default.object({
            name: joi_1.default.string().trim().min(1).max(100).required(),
            description: common_1.description,
            leaderId: joi_1.default.string().trim().max(100).optional(),
        }).required(),
        shipIds: common_1.idArray.optional(),
        squadronData: joi_1.default.object({
            name: joi_1.default.string().trim().min(1).max(100).required(),
            description: joi_1.default.string().trim().max(500).optional(),
        }).optional(),
        inventoryItems: joi_1.default.array()
            .items(joi_1.default.object({
            itemId: joi_1.default.string().trim().max(100).required(),
            quantity: joi_1.default.number().integer().positive().required(),
        }))
            .max(100)
            .optional(),
        notifyMembers: joi_1.default.boolean().default(false),
        postToDiscord: joi_1.default.boolean().default(false),
        discordChannelId: joi_1.default.string().trim().max(100).optional(),
    }),
};
//# sourceMappingURL=fleetSchemas.js.map