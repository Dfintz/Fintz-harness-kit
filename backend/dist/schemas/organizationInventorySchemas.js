"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizationInventorySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const OrganizationInventory_1 = require("../models/OrganizationInventory");
exports.organizationInventorySchemas = {
    create: joi_1.default.object({
        itemName: joi_1.default.string().trim().min(1).max(200).required(),
        description: joi_1.default.string().trim().max(1000).optional().allow(null, ''),
        category: joi_1.default.string()
            .valid(...Object.values(OrganizationInventory_1.OrganizationInventoryCategory))
            .required(),
        quantity: joi_1.default.number().integer().min(1).required(),
        unit: joi_1.default.string().trim().max(50).optional().allow(null, ''),
        unitValue: joi_1.default.number().min(0).required(),
        notes: joi_1.default.string().trim().max(2000).optional().allow(null, ''),
        location: joi_1.default.string().trim().max(200).optional().allow(null, ''),
        assignedTo: joi_1.default.string().trim().optional().allow(null, '')
    }),
    update: joi_1.default.object({
        itemName: joi_1.default.string().trim().min(1).max(200).optional(),
        description: joi_1.default.string().trim().max(1000).optional().allow(null, ''),
        category: joi_1.default.string()
            .valid(...Object.values(OrganizationInventory_1.OrganizationInventoryCategory))
            .optional(),
        quantity: joi_1.default.number().integer().min(1).optional(),
        unit: joi_1.default.string().trim().max(50).optional().allow(null, ''),
        unitValue: joi_1.default.number().min(0).optional(),
        notes: joi_1.default.string().trim().max(2000).optional().allow(null, ''),
        location: joi_1.default.string().trim().max(200).optional().allow(null, ''),
        assignedTo: joi_1.default.string().trim().optional().allow(null, '')
    }).min(1),
    query: joi_1.default.object({
        category: joi_1.default.alternatives()
            .try(joi_1.default.string().valid(...Object.values(OrganizationInventory_1.OrganizationInventoryCategory)), joi_1.default.array().items(joi_1.default.string().valid(...Object.values(OrganizationInventory_1.OrganizationInventoryCategory))))
            .optional(),
        searchTerm: joi_1.default.string().trim().max(200).optional(),
        assignedTo: joi_1.default.string().trim().optional(),
        page: joi_1.default.number().integer().min(1).optional(),
        limit: joi_1.default.number().integer().min(1).max(100).optional(),
        sortBy: joi_1.default.string()
            .valid('itemName', 'quantity', 'totalValue', 'category', 'createdAt', 'updatedAt')
            .optional(),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').optional()
    })
};
//# sourceMappingURL=organizationInventorySchemas.js.map