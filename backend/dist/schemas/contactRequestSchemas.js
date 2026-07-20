"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactRequestSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const ContactRequest_1 = require("../models/ContactRequest");
const common_1 = require("./common");
const contactRequestStatusValues = ['pending', 'read', 'replied', 'archived', 'spam'];
const contactTypeValues = [
    'general',
    'recruitment',
    'partnership',
    'question',
    'feedback',
    'other',
];
const targetTypeValues = ['organization', 'alliance'];
const visibilityValues = Object.values(ContactRequest_1.MessageVisibility);
const sortByValues = ['createdAt', 'updatedAt', 'status', 'senderName', 'subject'];
exports.contactRequestSchemas = {
    submitContactRequest: joi_1.default.object({
        targetType: joi_1.default.string()
            .valid(...targetTypeValues)
            .required(),
        organizationId: joi_1.default.string().uuid().when('targetType', {
            is: 'organization',
            then: joi_1.default.required(),
            otherwise: joi_1.default.optional(),
        }),
        allianceId: joi_1.default.string().when('targetType', {
            is: 'alliance',
            then: joi_1.default.required(),
            otherwise: joi_1.default.optional(),
        }),
        senderName: joi_1.default.string().trim().min(1).max(100).required(),
        senderEmail: joi_1.default.string().email().max(255).allow('', null).optional(),
        rsiHandle: joi_1.default.string().trim().max(100).allow('', null).optional(),
        discordUsername: joi_1.default.string().trim().max(100).allow('', null).optional(),
        subject: joi_1.default.string().trim().min(1).max(255).required(),
        message: joi_1.default.string().trim().min(10).max(5000).required(),
        contactType: joi_1.default.string()
            .valid(...contactTypeValues)
            .optional()
            .default('general'),
        visibility: joi_1.default.string()
            .valid(...visibilityValues)
            .optional()
            .default('all'),
        visibleToRoles: joi_1.default.array()
            .items(joi_1.default.string().trim().min(1).max(100))
            .min(1)
            .unique()
            .optional()
            .when('visibility', {
            is: 'custom',
            then: joi_1.default.required(),
            otherwise: joi_1.default.optional(),
        }),
    }),
    addReply: joi_1.default.object({
        message: joi_1.default.string().trim().min(1).max(5000).required(),
    }),
    listContactRequestsQuery: joi_1.default.object({
        ...common_1.paginationKeys,
        status: joi_1.default.string()
            .valid(...contactRequestStatusValues)
            .optional(),
        statuses: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string().valid(...contactRequestStatusValues)), joi_1.default.string().valid(...contactRequestStatusValues))
            .optional(),
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
        search: joi_1.default.string().trim().max(100).optional(),
        sortBy: joi_1.default.string()
            .valid(...sortByValues)
            .optional(),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').optional(),
    }),
    updateContactRequest: joi_1.default.object({
        status: joi_1.default.string()
            .valid(...contactRequestStatusValues)
            .optional(),
        internalNotes: joi_1.default.string().trim().max(5000).allow('', null).optional(),
    }).or('status', 'internalNotes'),
    contactRequestId: joi_1.default.object({
        requestId: joi_1.default.string().uuid().required(),
    }),
    organizationContactParams: joi_1.default.object({
        id: joi_1.default.string().uuid().required(),
        requestId: joi_1.default.string().uuid().required(),
    }),
    allianceContactParams: joi_1.default.object({
        allianceId: joi_1.default.string().required(),
        requestId: joi_1.default.string().uuid().required(),
    }),
};
//# sourceMappingURL=contactRequestSchemas.js.map