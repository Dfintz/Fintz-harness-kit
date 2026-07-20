"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fleetViewSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const fleetViewShip = joi_1.default.object({
    name: joi_1.default.string().trim().min(1).max(200).required(),
    manufacturer: joi_1.default.string().trim().min(1).max(100).optional(),
    kind: joi_1.default.string().trim().max(100).optional(),
    owned: joi_1.default.number().integer().min(0).max(999).optional(),
    warbond: joi_1.default.boolean().optional(),
    lti: joi_1.default.boolean().optional(),
    contains: joi_1.default.array().items(joi_1.default.string().trim()).optional(),
    pledge: joi_1.default.string().trim().max(200).optional(),
    cost: joi_1.default.number().min(0).optional(),
    notes: joi_1.default.string().trim().max(2000).optional(),
    tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).optional()
});
const fleetViewSchema = joi_1.default.object({
    version: joi_1.default.string().trim().optional(),
    updated: joi_1.default.string().isoDate().optional(),
    owner: joi_1.default.object({
        name: joi_1.default.string().trim().optional(),
        handle: joi_1.default.string().trim().optional(),
        orgName: joi_1.default.string().trim().optional(),
        orgSid: joi_1.default.string().trim().optional()
    }).optional(),
    ships: joi_1.default.array().items(fleetViewShip).min(1).required(),
    statistics: joi_1.default.object({
        totalShips: joi_1.default.number().integer().min(0).optional(),
        totalValue: joi_1.default.number().min(0).optional(),
        manufacturers: joi_1.default.object().pattern(joi_1.default.string(), joi_1.default.number().integer()).optional(),
        roles: joi_1.default.object().pattern(joi_1.default.string(), joi_1.default.number().integer()).optional()
    }).optional()
});
exports.fleetViewSchemas = {
    import: joi_1.default.object({
        schema: fleetViewSchema.required(),
        options: joi_1.default.object({
            merge: joi_1.default.boolean().default(true),
            skipDuplicates: joi_1.default.boolean().default(true),
            organizationId: common_1.id.required()
        }).optional()
    }),
    importFile: joi_1.default.object({
        merge: joi_1.default.boolean().optional(),
        skipDuplicates: joi_1.default.boolean().optional(),
        organizationId: common_1.id.optional()
    }),
    exportQuery: joi_1.default.object({
        organizationId: common_1.id.optional(),
        includeStatistics: joi_1.default.boolean().default(true),
        includeInactive: joi_1.default.boolean().default(false)
    }),
    exportOrgQuery: joi_1.default.object({
        organizationId: common_1.id.required(),
        includeStatistics: joi_1.default.boolean().default(true),
        includeInactive: joi_1.default.boolean().default(false)
    })
};
//# sourceMappingURL=fleetViewSchemas.js.map