"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shipSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.shipSchemas = {
    create: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).required(),
        model: joi_1.default.string().trim().min(1).max(100).required(),
        manufacturer: joi_1.default.string().trim().min(1).max(100).required(),
        role: joi_1.default.string()
            .valid('combat', 'cargo', 'mining', 'exploration', 'support', 'multi-role')
            .required(),
        status: joi_1.default.string()
            .valid('operational', 'maintenance', 'repair', 'decommissioned')
            .default('operational'),
        ownerId: common_1.id,
        cargoCapacity: joi_1.default.number().integer().min(0).optional(),
        crewSize: joi_1.default.number().integer().min(1).optional(),
        specifications: joi_1.default.object().optional(),
    }),
    update: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(200).optional(),
        status: joi_1.default.string().valid('operational', 'maintenance', 'repair', 'decommissioned').optional(),
        ownerId: joi_1.default.string().trim().optional(),
        cargoCapacity: joi_1.default.number().integer().min(0).optional(),
        crewSize: joi_1.default.number().integer().min(1).optional(),
    }),
    scheduleMaintenance: joi_1.default.object({
        shipId: common_1.id,
        maintenanceType: joi_1.default.string().valid('routine', 'repair', 'upgrade', 'inspection').required(),
        scheduledDate: joi_1.default.date().iso().required(),
        estimatedDuration: joi_1.default.number().integer().min(1).required(),
        estimatedCost: joi_1.default.number().min(0).optional(),
        priority: joi_1.default.string().valid('low', 'medium', 'high', 'critical').default('medium'),
        notes: common_1.notes,
    }),
    updateMaintenanceStatus: joi_1.default.object({
        status: joi_1.default.string().valid('scheduled', 'in_progress', 'completed', 'cancelled').required(),
        actualCost: joi_1.default.number().min(0).optional(),
        actualDuration: joi_1.default.number().integer().min(1).optional(),
        notes: common_1.notes,
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        role: joi_1.default.string()
            .valid('combat', 'cargo', 'mining', 'exploration', 'support', 'multi-role')
            .optional(),
        status: joi_1.default.string().valid('operational', 'maintenance', 'repair', 'decommissioned').optional(),
        ownerId: joi_1.default.string().trim().optional(),
        manufacturer: joi_1.default.string().trim().optional(),
    }),
    param: joi_1.default.object({
        id: common_1.id,
    }),
    createUserShip: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(100).required(),
        shipType: joi_1.default.string().trim().required(),
        manufacturer: joi_1.default.string().trim().optional(),
        userId: common_1.id.required(),
    }),
    updateUserShip: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(100).optional(),
        status: joi_1.default.string().valid('active', 'maintenance', 'destroyed', 'stored').optional(),
        location: joi_1.default.string().trim().optional(),
        notes: joi_1.default.string().max(500).optional(),
    }),
};
//# sourceMappingURL=shipSchemas.js.map