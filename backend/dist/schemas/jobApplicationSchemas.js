"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobApplicationSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const applicationTypeValues = ['crew', 'passenger', 'vehicle', 'general'];
const reviewStatusValues = ['approved', 'rejected', 'waitlisted'];
const applicationStatusValues = ['pending', 'approved', 'rejected', 'waitlisted', 'withdrawn'];
exports.jobApplicationSchemas = {
    applyToJob: joi_1.default.object({
        applicationType: joi_1.default.string()
            .valid(...applicationTypeValues)
            .required(),
        message: joi_1.default.string().trim().max(1000).allow('', null).optional(),
        shipIndex: joi_1.default.number().integer().min(0).when('applicationType', {
            is: 'crew',
            then: joi_1.default.required(),
            otherwise: joi_1.default.optional(),
        }),
        roleIndex: joi_1.default.number().integer().min(0).when('applicationType', {
            is: 'crew',
            then: joi_1.default.required(),
            otherwise: joi_1.default.optional(),
        }),
        passengerShipIndex: joi_1.default.number().integer().min(0).when('applicationType', {
            is: 'passenger',
            then: joi_1.default.required(),
            otherwise: joi_1.default.optional(),
        }),
        passengerRole: joi_1.default.string().trim().max(100).when('applicationType', {
            is: 'passenger',
            then: joi_1.default.optional(),
            otherwise: joi_1.default.optional(),
        }),
        vehicleName: joi_1.default.string().trim().max(255).when('applicationType', {
            is: 'vehicle',
            then: joi_1.default.required(),
            otherwise: joi_1.default.optional(),
        }),
        formResponses: joi_1.default.object()
            .pattern(joi_1.default.string().uuid(), joi_1.default.string().max(5000))
            .max(20)
            .optional(),
    }),
    reviewApplication: joi_1.default.object({
        status: joi_1.default.string()
            .valid(...reviewStatusValues)
            .required(),
        reviewNote: joi_1.default.string().trim().max(1000).allow('', null).optional(),
    }),
    applicationListQuery: joi_1.default.object({
        status: joi_1.default.string()
            .valid(...applicationStatusValues)
            .optional(),
    }),
};
//# sourceMappingURL=jobApplicationSchemas.js.map