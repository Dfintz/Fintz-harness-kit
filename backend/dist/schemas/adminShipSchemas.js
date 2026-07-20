"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminShipSchemas = exports.catalogShipParam = exports.catalogShipQuery = exports.updateCatalogShip = exports.createCatalogShip = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const shipSizes = ['vehicle', 'snub', 'small', 'medium', 'large', 'sub_capital', 'capital'];
const shipStatuses = ['flight_ready', 'in_concept', 'in_production', 'announced'];
const weaponSchema = joi_1.default.object({
    type: joi_1.default.string().trim().max(100).required(),
    size: joi_1.default.number().integer().min(0).required(),
    count: joi_1.default.number().integer().min(1).required(),
});
const hardpointSchema = joi_1.default.object({
    type: joi_1.default.string().trim().max(100).required(),
    size: joi_1.default.number().integer().min(0).required(),
    location: joi_1.default.string().trim().max(100).required(),
});
exports.createCatalogShip = joi_1.default.object({
    name: joi_1.default.string().trim().min(1).max(200).required(),
    manufacturer: joi_1.default.string().trim().min(1).max(200).required(),
    manufacturerCode: joi_1.default.string().trim().max(50).optional(),
    description: joi_1.default.string().trim().max(5000).optional(),
    role: joi_1.default.string().trim().max(100).optional(),
    career: joi_1.default.string().trim().max(100).optional(),
    roles: joi_1.default.array().items(joi_1.default.string().trim().max(100)).max(20).optional(),
    size: joi_1.default.string()
        .valid(...shipSizes)
        .optional(),
    status: joi_1.default.string()
        .valid(...shipStatuses)
        .default('flight_ready'),
    crew: joi_1.default.number().integer().min(0).optional(),
    minCrew: joi_1.default.number().integer().min(0).optional(),
    maxCrew: joi_1.default.number().integer().min(0).optional(),
    length: joi_1.default.number().min(0).optional(),
    beam: joi_1.default.number().min(0).optional(),
    height: joi_1.default.number().min(0).optional(),
    mass: joi_1.default.number().min(0).optional(),
    cargo: joi_1.default.number().integer().min(0).optional(),
    vehicleCargo: joi_1.default.number().integer().min(0).optional(),
    price: joi_1.default.number().min(0).optional(),
    pledgePrice: joi_1.default.number().integer().min(0).optional(),
    speed: joi_1.default.number().integer().min(0).optional(),
    afterburnerSpeed: joi_1.default.number().integer().min(0).optional(),
    quantumSpeed: joi_1.default.number().integer().min(0).optional(),
    quantumFuelCapacity: joi_1.default.number().integer().min(0).optional(),
    hydrogenFuelCapacity: joi_1.default.number().integer().min(0).optional(),
    shields: joi_1.default.number().integer().min(0).optional(),
    armor: joi_1.default.number().integer().min(0).optional(),
    weapons: joi_1.default.array().items(weaponSchema).max(50).optional(),
    hardpoints: joi_1.default.array().items(hardpointSchema).max(50).optional(),
    hangarSize: joi_1.default.string().trim().max(50).optional(),
    storageUrl: joi_1.default.string().uri().trim().optional().allow(''),
    thumbnailUrl: joi_1.default.string().uri().trim().optional().allow(''),
    imageUrl: joi_1.default.string().uri().trim().optional().allow(''),
    brochureUrl: joi_1.default.string().uri().trim().optional().allow(''),
    isActive: joi_1.default.boolean().default(true),
    loanerShip: joi_1.default.string().trim().max(200).optional(),
    variants: joi_1.default.array().items(joi_1.default.string().trim().max(200)).max(50).optional(),
    isVehicle: joi_1.default.boolean().default(false),
    metadata: joi_1.default.object().pattern(joi_1.default.string(), joi_1.default.any()).optional(),
});
exports.updateCatalogShip = exports.createCatalogShip.fork(['name', 'manufacturer'], schema => schema.optional());
exports.catalogShipQuery = joi_1.default.object({
    ...(0, common_1.paginationKeysWith)(25),
    search: joi_1.default.string().trim().max(200).optional(),
    manufacturer: joi_1.default.string().trim().max(200).optional(),
    size: joi_1.default.string()
        .valid(...shipSizes)
        .optional(),
    status: joi_1.default.string()
        .valid(...shipStatuses)
        .optional(),
    isVehicle: joi_1.default.boolean().optional(),
    isActive: joi_1.default.boolean().optional(),
    sort: joi_1.default.string()
        .valid('name', 'manufacturer', 'size', 'status', 'updatedAt', 'createdAt')
        .default('name'),
    order: joi_1.default.string().valid('asc', 'desc').default('asc'),
});
exports.catalogShipParam = joi_1.default.object({
    shipId: joi_1.default.string().trim().min(1).max(200).required(),
});
exports.adminShipSchemas = {
    createCatalogShip: exports.createCatalogShip,
    updateCatalogShip: exports.updateCatalogShip,
    catalogShipQuery: exports.catalogShipQuery,
    catalogShipParam: exports.catalogShipParam,
};
//# sourceMappingURL=adminShipSchemas.js.map