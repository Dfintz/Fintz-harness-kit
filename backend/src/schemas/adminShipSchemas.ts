import Joi from 'joi';

import { paginationKeysWith } from './common';

const shipSizes = ['vehicle', 'snub', 'small', 'medium', 'large', 'sub_capital', 'capital'];
const shipStatuses = ['flight_ready', 'in_concept', 'in_production', 'announced'];

const weaponSchema = Joi.object({
  type: Joi.string().trim().max(100).required(),
  size: Joi.number().integer().min(0).required(),
  count: Joi.number().integer().min(1).required(),
});

const hardpointSchema = Joi.object({
  type: Joi.string().trim().max(100).required(),
  size: Joi.number().integer().min(0).required(),
  location: Joi.string().trim().max(100).required(),
});

/**
 * Schema for creating a catalog ship (admin only)
 */
export const createCatalogShip = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  manufacturer: Joi.string().trim().min(1).max(200).required(),
  manufacturerCode: Joi.string().trim().max(50).optional(),
  description: Joi.string().trim().max(5000).optional(),
  role: Joi.string().trim().max(100).optional(),
  career: Joi.string().trim().max(100).optional(),
  roles: Joi.array().items(Joi.string().trim().max(100)).max(20).optional(),
  size: Joi.string()
    .valid(...shipSizes)
    .optional(),
  status: Joi.string()
    .valid(...shipStatuses)
    .default('flight_ready'),
  crew: Joi.number().integer().min(0).optional(),
  minCrew: Joi.number().integer().min(0).optional(),
  maxCrew: Joi.number().integer().min(0).optional(),
  length: Joi.number().min(0).optional(),
  beam: Joi.number().min(0).optional(),
  height: Joi.number().min(0).optional(),
  mass: Joi.number().min(0).optional(),
  cargo: Joi.number().integer().min(0).optional(),
  vehicleCargo: Joi.number().integer().min(0).optional(),
  price: Joi.number().min(0).optional(),
  pledgePrice: Joi.number().integer().min(0).optional(),
  speed: Joi.number().integer().min(0).optional(),
  afterburnerSpeed: Joi.number().integer().min(0).optional(),
  quantumSpeed: Joi.number().integer().min(0).optional(),
  quantumFuelCapacity: Joi.number().integer().min(0).optional(),
  hydrogenFuelCapacity: Joi.number().integer().min(0).optional(),
  shields: Joi.number().integer().min(0).optional(),
  armor: Joi.number().integer().min(0).optional(),
  weapons: Joi.array().items(weaponSchema).max(50).optional(),
  hardpoints: Joi.array().items(hardpointSchema).max(50).optional(),
  hangarSize: Joi.string().trim().max(50).optional(),
  storageUrl: Joi.string().uri().trim().optional().allow(''),
  thumbnailUrl: Joi.string().uri().trim().optional().allow(''),
  imageUrl: Joi.string().uri().trim().optional().allow(''),
  brochureUrl: Joi.string().uri().trim().optional().allow(''),
  isActive: Joi.boolean().default(true),
  loanerShip: Joi.string().trim().max(200).optional(),
  variants: Joi.array().items(Joi.string().trim().max(200)).max(50).optional(),
  isVehicle: Joi.boolean().default(false),
  metadata: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
});

/**
 * Schema for updating a catalog ship (all fields optional)
 */
export const updateCatalogShip = createCatalogShip.fork(['name', 'manufacturer'], schema =>
  schema.optional()
);

/**
 * Schema for listing/searching catalog ships
 */
export const catalogShipQuery = Joi.object({
  ...paginationKeysWith(25),
  search: Joi.string().trim().max(200).optional(),
  manufacturer: Joi.string().trim().max(200).optional(),
  size: Joi.string()
    .valid(...shipSizes)
    .optional(),
  status: Joi.string()
    .valid(...shipStatuses)
    .optional(),
  isVehicle: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
  sort: Joi.string()
    .valid('name', 'manufacturer', 'size', 'status', 'updatedAt', 'createdAt')
    .default('name'),
  order: Joi.string().valid('asc', 'desc').default('asc'),
});

/**
 * Ship ID parameter schema
 */
export const catalogShipParam = Joi.object({
  shipId: Joi.string().trim().min(1).max(200).required(),
});

export const adminShipSchemas = {
  createCatalogShip,
  updateCatalogShip,
  catalogShipQuery,
  catalogShipParam,
};
