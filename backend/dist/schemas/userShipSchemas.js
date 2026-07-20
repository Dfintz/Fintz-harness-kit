"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userShipSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.userShipSchemas = {
    createUserShip: joi_1.default.object({
        userId: common_1.id,
        shipId: common_1.id,
        shipName: joi_1.default.string().trim().min(1).max(200).required(),
        customName: joi_1.default.string().trim().max(200).optional().allow(null),
        status: joi_1.default.string()
            .valid('owned', 'pledged', 'loaned', 'gifted', 'lost', 'destroyed', 'sold')
            .default('owned'),
        condition: joi_1.default.string()
            .valid('pristine', 'excellent', 'good', 'fair', 'poor', 'damaged', 'critical')
            .default('good'),
        acquiredDate: joi_1.default.date().iso().optional().allow(null),
        acquiredPrice: joi_1.default.number().min(0).max(999999999.99).optional().allow(null),
        acquiredCurrency: joi_1.default.string().trim().max(10).optional().allow(null),
        insuranceLevel: joi_1.default.string().trim().max(100).optional().allow(null),
        insuranceExpires: joi_1.default.date().iso().optional().allow(null),
        location: joi_1.default.string().trim().max(200).optional().allow(null),
        hangar: joi_1.default.string().trim().max(200).optional().allow(null),
        description: joi_1.default.string().trim().max(2000).optional().allow(null, ''),
        notes: common_1.notes,
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(20).optional(),
        sharingLevel: joi_1.default.string()
            .valid('private', 'personal', 'shared_users', 'organization', 'alliance', 'public')
            .default('organization'),
        sharedWithUsers: joi_1.default.array().items(common_1.id).optional(),
        modifications: joi_1.default.object({
            components: joi_1.default.array().items(joi_1.default.string()).optional(),
            weapons: joi_1.default.array().items(joi_1.default.string()).optional(),
            upgrades: joi_1.default.array().items(joi_1.default.string()).optional(),
            customization: joi_1.default.object().max(50).optional().allow(null),
        })
            .optional()
            .allow(null),
    }),
    updateUserShip: joi_1.default.object({
        customName: joi_1.default.string().trim().max(200).optional().allow(null),
        status: joi_1.default.string()
            .valid('owned', 'pledged', 'loaned', 'gifted', 'lost', 'destroyed', 'sold')
            .optional(),
        condition: joi_1.default.string()
            .valid('pristine', 'excellent', 'good', 'fair', 'poor', 'damaged', 'critical')
            .optional(),
        insuranceLevel: joi_1.default.string().trim().max(100).optional().allow(null),
        insuranceExpires: joi_1.default.date().iso().optional().allow(null),
        location: joi_1.default.string().trim().max(200).optional().allow(null),
        hangar: joi_1.default.string().trim().max(200).optional().allow(null),
        description: joi_1.default.string().trim().max(2000).optional().allow(null, ''),
        notes: common_1.notes,
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(20).optional(),
        sharingLevel: joi_1.default.string()
            .valid('private', 'personal', 'shared_users', 'organization', 'alliance', 'public')
            .optional(),
        useCustomVisibility: joi_1.default.boolean().optional(),
        sharedWithUsers: joi_1.default.array().items(common_1.id).optional(),
        isActive: joi_1.default.boolean().optional(),
        flightHours: joi_1.default.number().integer().min(0).optional(),
        missionsCompleted: joi_1.default.number().integer().min(0).optional(),
        totalEarnings: joi_1.default.number().min(0).max(9999999999999.99).optional(),
        modifications: joi_1.default.object({
            components: joi_1.default.array().items(joi_1.default.string()).optional(),
            weapons: joi_1.default.array().items(joi_1.default.string()).optional(),
            upgrades: joi_1.default.array().items(joi_1.default.string()).optional(),
            customization: joi_1.default.object().max(50).optional().allow(null),
        })
            .optional()
            .allow(null),
        erkulLoadoutUrl: joi_1.default.string()
            .uri({ scheme: ['https'] })
            .trim()
            .max(500)
            .optional()
            .allow(null, ''),
    }),
    loanShip: joi_1.default.object({
        loanedTo: common_1.id,
        loanExpires: joi_1.default.date().iso().min('now').required(),
        notes: common_1.notes,
    }),
    query: joi_1.default.object({
        status: joi_1.default.string()
            .valid('owned', 'pledged', 'loaned', 'gifted', 'lost', 'destroyed', 'sold')
            .optional(),
        condition: joi_1.default.string()
            .valid('pristine', 'excellent', 'good', 'fair', 'poor', 'damaged', 'critical')
            .optional(),
        sharingLevel: joi_1.default.string()
            .valid('private', 'personal', 'shared_users', 'organization', 'alliance', 'public')
            .optional(),
        useCustomVisibility: joi_1.default.boolean().optional(),
        isActive: joi_1.default.boolean().optional(),
        tags: joi_1.default.array().items(joi_1.default.string()).optional(),
        page: joi_1.default.number().integer().min(1).default(1),
        limit: joi_1.default.number().integer().min(1).max(100).default(10),
    }),
};
//# sourceMappingURL=userShipSchemas.js.map