"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizationShipSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.organizationShipSchemas = {
    createOrgShip: joi_1.default.object({
        shipId: common_1.id,
        shipName: joi_1.default.string().trim().min(1).max(200).required(),
        customName: joi_1.default.string().trim().max(200).optional().allow(null),
        role: joi_1.default.string()
            .valid('command', 'combat', 'logistics', 'mining', 'exploration', 'medical', 'transport', 'support', 'reserve')
            .default('reserve'),
        status: joi_1.default.string()
            .valid('owned', 'pledged', 'loaned', 'gifted', 'lost', 'destroyed', 'sold')
            .default('owned'),
        condition: joi_1.default.string()
            .valid('pristine', 'excellent', 'good', 'fair', 'poor', 'damaged', 'critical')
            .default('good'),
        acquisitionMethod: joi_1.default.string().trim().max(100).optional().allow(null),
        acquiredBy: common_1.id.optional().allow(null),
        acquiredDate: joi_1.default.date().iso().optional().allow(null),
        acquisitionCost: joi_1.default.number().min(0).max(9999999999.99).optional().allow(null),
        maxCrew: joi_1.default.number().integer().min(1).max(100).optional().allow(null),
        location: joi_1.default.string().trim().max(200).optional().allow(null),
        homeBase: joi_1.default.string().trim().max(200).optional().allow(null),
        insuranceLevel: joi_1.default.string().trim().max(100).optional().allow(null),
        insuranceExpires: joi_1.default.date().iso().optional().allow(null),
        isCapital: joi_1.default.boolean().default(false),
        requiresPermission: joi_1.default.boolean().default(false),
        minimumRank: joi_1.default.string().trim().max(50).optional().allow(null),
        sharingLevel: joi_1.default.string()
            .valid('private', 'personal', 'shared_users', 'organization', 'alliance', 'public')
            .default('organization')
            .optional(),
        minRequiredRank: joi_1.default.number().integer().min(1).max(10).optional().allow(null),
        useCustomVisibility: joi_1.default.boolean().default(false).optional(),
        notes: common_1.notes,
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(20).optional(),
        modifications: joi_1.default.object({
            components: joi_1.default.array().items(joi_1.default.string()).optional(),
            weapons: joi_1.default.array().items(joi_1.default.string()).optional(),
            upgrades: joi_1.default.array().items(joi_1.default.string()).optional(),
            cargo: joi_1.default.any().optional(),
        })
            .optional()
            .allow(null),
    }),
    updateOrgShip: joi_1.default.object({
        customName: joi_1.default.string().trim().max(200).optional().allow(null),
        role: joi_1.default.string()
            .valid('command', 'combat', 'logistics', 'mining', 'exploration', 'medical', 'transport', 'support', 'reserve')
            .optional(),
        status: joi_1.default.string()
            .valid('owned', 'pledged', 'loaned', 'gifted', 'lost', 'destroyed', 'sold')
            .optional(),
        condition: joi_1.default.string()
            .valid('pristine', 'excellent', 'good', 'fair', 'poor', 'damaged', 'critical')
            .optional(),
        location: joi_1.default.string().trim().max(200).optional().allow(null),
        homeBase: joi_1.default.string().trim().max(200).optional().allow(null),
        insuranceLevel: joi_1.default.string().trim().max(100).optional().allow(null),
        insuranceExpires: joi_1.default.date().iso().optional().allow(null),
        lastMaintenance: joi_1.default.date().iso().optional().allow(null),
        nextMaintenance: joi_1.default.date().iso().optional().allow(null),
        isAvailable: joi_1.default.boolean().optional(),
        isActive: joi_1.default.boolean().optional(),
        requiresPermission: joi_1.default.boolean().optional(),
        minimumRank: joi_1.default.string().trim().max(50).optional().allow(null),
        sharingLevel: joi_1.default.string()
            .valid('private', 'personal', 'shared_users', 'organization', 'alliance', 'public')
            .optional(),
        minRequiredRank: joi_1.default.number().integer().min(1).max(10).optional().allow(null),
        useCustomVisibility: joi_1.default.boolean().optional(),
        notes: common_1.notes,
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(20).optional(),
        flightHours: joi_1.default.number().integer().min(0).optional(),
        missionsCompleted: joi_1.default.number().integer().min(0).optional(),
        totalEarnings: joi_1.default.number().min(0).max(9999999999999.99).optional(),
        maintenanceCosts: joi_1.default.number().min(0).max(9999999999999.99).optional(),
        modifications: joi_1.default.object({
            components: joi_1.default.array().items(joi_1.default.string()).optional(),
            weapons: joi_1.default.array().items(joi_1.default.string()).optional(),
            upgrades: joi_1.default.array().items(joi_1.default.string()).optional(),
            cargo: joi_1.default.any().optional(),
        })
            .optional()
            .allow(null),
    }),
    assignCaptain: joi_1.default.object({
        captainId: common_1.id,
    }),
    assignCrew: joi_1.default.object({
        crewIds: common_1.idArray,
    }),
    addCrewMember: joi_1.default.object({
        userId: common_1.id,
    }),
    query: joi_1.default.object({
        role: joi_1.default.string()
            .valid('command', 'combat', 'logistics', 'mining', 'exploration', 'medical', 'transport', 'support', 'reserve')
            .optional(),
        status: joi_1.default.string()
            .valid('owned', 'pledged', 'loaned', 'gifted', 'lost', 'destroyed', 'sold')
            .optional(),
        condition: joi_1.default.string()
            .valid('pristine', 'excellent', 'good', 'fair', 'poor', 'damaged', 'critical')
            .optional(),
        isAvailable: joi_1.default.boolean().optional(),
        isCapital: joi_1.default.boolean().optional(),
        isActive: joi_1.default.boolean().optional(),
        requiresPermission: joi_1.default.boolean().optional(),
        sharingLevel: joi_1.default.string()
            .valid('private', 'personal', 'shared_users', 'organization', 'alliance', 'public')
            .optional(),
        minRequiredRank: joi_1.default.number().integer().min(1).max(10).optional(),
        tags: joi_1.default.array().items(joi_1.default.string()).optional(),
        search: joi_1.default.string().trim().max(200).optional(),
        ...(0, common_1.paginationKeysWith)(25, 500),
    }),
};
//# sourceMappingURL=organizationShipSchemas.js.map