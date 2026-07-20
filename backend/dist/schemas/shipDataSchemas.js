"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shipDataSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const Ship_1 = require("../models/Ship");
const common_1 = require("./common");
const sizeValues = Object.values(Ship_1.ShipSize);
const statusValues = Object.values(Ship_1.ShipStatus);
const paginationWithSorting = common_1.pagination.keys({
    sortBy: joi_1.default.string()
        .valid('name', 'manufacturer', 'size', 'status', 'createdAt', 'updatedAt')
        .default('name'),
    sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('ASC'),
});
const sharedFilters = {
    manufacturer: joi_1.default.string().trim().max(200).optional(),
    size: joi_1.default.string()
        .valid(...sizeValues)
        .optional(),
    role: joi_1.default.string().trim().max(200).optional(),
    status: joi_1.default.string()
        .valid(...statusValues)
        .optional(),
    search: joi_1.default.string().trim().max(200).optional(),
    isVehicle: joi_1.default.boolean().optional(),
    isActive: joi_1.default.boolean().optional(),
};
const numericField = joi_1.default.number().precision(2).min(0).optional();
const shipBaseFields = {
    id: joi_1.default.string().trim().max(100).optional(),
    name: joi_1.default.string().trim().min(1).max(200).required(),
    manufacturer: joi_1.default.string().trim().min(1).max(200).required(),
    manufacturerCode: joi_1.default.string().trim().max(20).optional(),
    description: joi_1.default.string().trim().max(2000).optional(),
    role: joi_1.default.string().trim().max(200).optional(),
    roles: joi_1.default.array().items(joi_1.default.string().trim().max(200)).optional(),
    size: joi_1.default.string()
        .valid(...sizeValues)
        .optional(),
    status: joi_1.default.string()
        .valid(...statusValues)
        .optional(),
    crew: joi_1.default.number().integer().min(0).optional(),
    minCrew: joi_1.default.number().integer().min(0).optional(),
    maxCrew: joi_1.default.number().integer().min(0).optional(),
    length: numericField,
    beam: numericField,
    height: numericField,
    mass: numericField,
    cargo: numericField,
    vehicleCargo: numericField,
    price: numericField,
    pledgePrice: numericField,
    speed: numericField,
    afterburnerSpeed: numericField,
    quantumSpeed: numericField,
    quantumFuelCapacity: numericField,
    hydrogenFuelCapacity: numericField,
    shields: numericField,
    armor: numericField,
    hangarSize: joi_1.default.string().trim().max(100).optional(),
    loanerShip: joi_1.default.string().trim().max(200).optional(),
    variants: joi_1.default.array().items(joi_1.default.string().trim().max(200)).optional(),
    weapons: joi_1.default.array()
        .items(joi_1.default.object({
        type: joi_1.default.string().trim().max(100).required(),
        size: joi_1.default.number().integer().min(0).required(),
        count: joi_1.default.number().integer().min(0).required(),
    }))
        .optional(),
    hardpoints: joi_1.default.array()
        .items(joi_1.default.object({
        type: joi_1.default.string().trim().max(100).required(),
        size: joi_1.default.number().integer().min(0).required(),
        location: joi_1.default.string().trim().max(100).required(),
    }))
        .optional(),
    storageUrl: joi_1.default.string().uri().optional(),
    thumbnailUrl: joi_1.default.string().uri().optional(),
    imageUrl: joi_1.default.string().uri().optional(),
    brochureUrl: joi_1.default.string().uri().optional(),
    isVehicle: joi_1.default.boolean().optional(),
    isActive: joi_1.default.boolean().optional(),
    metadata: joi_1.default.object().unknown(true).optional(),
};
exports.shipDataSchemas = {
    listQuery: paginationWithSorting.keys(sharedFilters),
    vehicleQuery: common_1.pagination.keys({
        manufacturer: joi_1.default.string().trim().max(200).optional(),
        search: joi_1.default.string().trim().max(200).optional(),
    }),
    spacecraftQuery: common_1.pagination.keys({
        manufacturer: joi_1.default.string().trim().max(200).optional(),
        size: joi_1.default.string()
            .valid(...sizeValues)
            .optional(),
        role: joi_1.default.string().trim().max(200).optional(),
        search: joi_1.default.string().trim().max(200).optional(),
    }),
    searchQuery: joi_1.default.object({
        q: joi_1.default.string().trim().min(1).max(200).required(),
    }),
    idParam: joi_1.default.object({
        id: joi_1.default.string().trim().min(1).max(100).required(),
    }),
    createShip: joi_1.default.object(shipBaseFields),
    updateShip: joi_1.default.object({
        ...shipBaseFields,
        name: shipBaseFields.name.optional(),
        manufacturer: shipBaseFields.manufacturer.optional(),
    }),
};
//# sourceMappingURL=shipDataSchemas.js.map