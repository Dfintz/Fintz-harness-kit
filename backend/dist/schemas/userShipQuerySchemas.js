"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userShipQuerySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const UserShip_1 = require("../models/UserShip");
const common_1 = require("./common");
const statusValues = Object.values(UserShip_1.ShipOwnershipStatus);
const conditionValues = Object.values(UserShip_1.ShipCondition);
const sharingLevelValues = Object.values(UserShip_1.ShipSharingLevel);
const stringToArray = (allowed) => joi_1.default.alternatives()
    .try(joi_1.default.array()
    .items(joi_1.default.string().valid(...allowed))
    .unique(), joi_1.default.string().custom((value, helpers) => {
    if (typeof value !== 'string') {
        return helpers.error('any.invalid');
    }
    const items = value
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
    const { error, value: validated } = joi_1.default.array()
        .items(joi_1.default.string().valid(...allowed))
        .unique()
        .validate(items, { convert: true });
    if (error) {
        return helpers.error('any.invalid');
    }
    return validated;
}))
    .optional();
exports.userShipQuerySchemas = {
    listQuery: common_1.pagination.keys({
        shipId: joi_1.default.string().trim().optional(),
        status: stringToArray(statusValues),
        condition: stringToArray(conditionValues),
        location: joi_1.default.string().trim().optional(),
        search: joi_1.default.string().trim().max(200).optional(),
        tags: stringToArray([]),
        isLoaned: joi_1.default.boolean().optional(),
        sharingLevel: stringToArray(sharingLevelValues),
        sortBy: joi_1.default.string().valid('shipName', 'createdAt', 'updatedAt', 'status').default('createdAt'),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('DESC'),
    }),
    userIdParam: joi_1.default.object({
        userId: joi_1.default.string().trim().required(),
    }),
    shipIdParam: joi_1.default.object({
        shipId: joi_1.default.string().trim().required(),
    }),
    userShipParam: joi_1.default.object({
        userId: joi_1.default.string().trim().required(),
        shipId: joi_1.default.string().trim().required(),
    }),
    createShip: joi_1.default.object({
        shipId: joi_1.default.string().trim().optional(),
        shipName: joi_1.default.string().trim().min(1).max(200).required(),
        manufacturer: joi_1.default.string().trim().max(200).optional(),
        model: joi_1.default.string().trim().max(200).optional(),
        variant: joi_1.default.string().trim().max(200).optional(),
        pledgeDate: joi_1.default.date().iso().optional(),
        purchasePrice: joi_1.default.number().min(0).optional(),
        customName: joi_1.default.string().trim().max(200).optional(),
        location: joi_1.default.string().trim().max(200).optional(),
        condition: joi_1.default.string()
            .valid(...conditionValues)
            .optional(),
        status: joi_1.default.string()
            .valid(...statusValues)
            .optional(),
        sharingLevel: joi_1.default.string()
            .valid(...sharingLevelValues)
            .optional(),
        tags: joi_1.default.array().items(joi_1.default.string().trim()).optional(),
        insuranceLevel: joi_1.default.string().trim().max(100).optional(),
        insuranceProvider: joi_1.default.string().trim().max(100).optional(),
        insurancePolicyId: joi_1.default.string().trim().max(100).optional(),
        insuranceExpiryDate: joi_1.default.date().iso().optional(),
        description: joi_1.default.string().trim().max(2000).allow('').optional(),
        notes: joi_1.default.string().trim().max(1000).optional(),
        metadata: joi_1.default.object().unknown(true).optional(),
    }),
    updateShip: joi_1.default.object({
        customName: joi_1.default.string().trim().max(200).allow('').optional(),
        location: joi_1.default.string().trim().max(200).allow('').optional(),
        condition: joi_1.default.string()
            .valid(...conditionValues)
            .optional(),
        status: joi_1.default.string()
            .valid(...statusValues)
            .optional(),
        sharingLevel: joi_1.default.string()
            .valid(...sharingLevelValues)
            .optional(),
        sharedWithUsers: joi_1.default.array().items(joi_1.default.string().trim().max(100)).optional(),
        tags: joi_1.default.array().items(joi_1.default.string().trim()).optional(),
        insuranceLevel: joi_1.default.string().trim().max(100).optional(),
        insuranceProvider: joi_1.default.string().trim().max(100).optional(),
        insurancePolicyId: joi_1.default.string().trim().max(100).optional(),
        insuranceExpiryDate: joi_1.default.date().iso().optional(),
        erkulLoadoutUrl: joi_1.default.string()
            .trim()
            .uri({ scheme: ['https'] })
            .max(500)
            .allow('')
            .optional(),
        description: joi_1.default.string().trim().max(2000).allow('').optional(),
        notes: joi_1.default.string().trim().max(1000).optional(),
    }),
    loanShip: joi_1.default.object({
        scope: joi_1.default.string().valid('organization', 'alliance').required(),
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
        purpose: joi_1.default.string().trim().max(500).optional(),
        notes: joi_1.default.string().trim().max(1000).optional(),
        activityId: joi_1.default.string().trim().max(100).optional(),
        activityName: joi_1.default.string().trim().max(200).optional(),
    }),
};
//# sourceMappingURL=userShipQuerySchemas.js.map