import Joi from 'joi';

import { ShipSize, ShipStatus } from '../models/Ship';

import { pagination } from './common';

const sizeValues = Object.values(ShipSize);
const statusValues = Object.values(ShipStatus);

const paginationWithSorting = pagination.keys({
  sortBy: Joi.string()
    .valid('name', 'manufacturer', 'size', 'status', 'createdAt', 'updatedAt')
    .default('name'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('ASC'),
});

const sharedFilters = {
  manufacturer: Joi.string().trim().max(200).optional(),
  size: Joi.string()
    .valid(...sizeValues)
    .optional(),
  role: Joi.string().trim().max(200).optional(),
  status: Joi.string()
    .valid(...statusValues)
    .optional(),
  search: Joi.string().trim().max(200).optional(),
  isVehicle: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
};

const numericField = Joi.number().precision(2).min(0).optional();

const shipBaseFields = {
  id: Joi.string().trim().max(100).optional(),
  name: Joi.string().trim().min(1).max(200).required(),
  manufacturer: Joi.string().trim().min(1).max(200).required(),
  manufacturerCode: Joi.string().trim().max(20).optional(),
  description: Joi.string().trim().max(2000).optional(),
  role: Joi.string().trim().max(200).optional(),
  roles: Joi.array().items(Joi.string().trim().max(200)).optional(),
  size: Joi.string()
    .valid(...sizeValues)
    .optional(),
  status: Joi.string()
    .valid(...statusValues)
    .optional(),
  crew: Joi.number().integer().min(0).optional(),
  minCrew: Joi.number().integer().min(0).optional(),
  maxCrew: Joi.number().integer().min(0).optional(),
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
  hangarSize: Joi.string().trim().max(100).optional(),
  loanerShip: Joi.string().trim().max(200).optional(),
  variants: Joi.array().items(Joi.string().trim().max(200)).optional(),
  weapons: Joi.array()
    .items(
      Joi.object({
        type: Joi.string().trim().max(100).required(),
        size: Joi.number().integer().min(0).required(),
        count: Joi.number().integer().min(0).required(),
      })
    )
    .optional(),
  hardpoints: Joi.array()
    .items(
      Joi.object({
        type: Joi.string().trim().max(100).required(),
        size: Joi.number().integer().min(0).required(),
        location: Joi.string().trim().max(100).required(),
      })
    )
    .optional(),
  storageUrl: Joi.string().uri().optional(),
  thumbnailUrl: Joi.string().uri().optional(),
  imageUrl: Joi.string().uri().optional(),
  brochureUrl: Joi.string().uri().optional(),
  isVehicle: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
  metadata: Joi.object().unknown(true).optional(),
};

export const shipDataSchemas = {
  listQuery: paginationWithSorting.keys(sharedFilters),

  vehicleQuery: pagination.keys({
    manufacturer: Joi.string().trim().max(200).optional(),
    search: Joi.string().trim().max(200).optional(),
  }),

  spacecraftQuery: pagination.keys({
    manufacturer: Joi.string().trim().max(200).optional(),
    size: Joi.string()
      .valid(...sizeValues)
      .optional(),
    role: Joi.string().trim().max(200).optional(),
    search: Joi.string().trim().max(200).optional(),
  }),

  searchQuery: Joi.object({
    q: Joi.string().trim().min(1).max(200).required(),
  }),

  idParam: Joi.object({
    id: Joi.string().trim().min(1).max(100).required(),
  }),

  createShip: Joi.object(shipBaseFields),

  updateShip: Joi.object({
    ...shipBaseFields,
    name: shipBaseFields.name.optional(),
    manufacturer: shipBaseFields.manufacturer.optional(),
  }),
};
