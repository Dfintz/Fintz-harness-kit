"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ticketSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const Ticket_1 = require("../models/Ticket");
const common_1 = require("./common");
const ticketCategories = Object.values(Ticket_1.TicketCategory);
const ticketPriorities = Object.values(Ticket_1.TicketPriority);
const ticketStatuses = Object.values(Ticket_1.TicketStatus);
const ticketRecipientTypes = Object.values(Ticket_1.TicketRecipientType);
const routingConditionFields = [
    'category',
    'priority',
    'subject',
    'description',
    'tags',
    'creatorDiscordId',
    'creatorEmail',
];
const routingConditionOperators = [
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'starts_with',
    'ends_with',
    'greater_than',
    'less_than',
    'in_list',
    'not_in_list',
    'matches_regex',
];
const routingActionTypes = [
    'assign_to_user',
    'assign_to_role',
    'add_tags',
    'set_priority',
    'send_notification',
    'escalate',
    'auto_respond',
];
const routingConditionSchema = joi_1.default.object({
    field: joi_1.default.string()
        .valid(...routingConditionFields)
        .required(),
    operator: joi_1.default.string()
        .valid(...routingConditionOperators)
        .required(),
    value: joi_1.default.alternatives()
        .try(joi_1.default.string(), joi_1.default.number(), joi_1.default.array().items(joi_1.default.string()))
        .required(),
});
const routingActionSchema = joi_1.default.object({
    type: joi_1.default.string()
        .valid(...routingActionTypes)
        .required(),
    value: joi_1.default.alternatives()
        .try(joi_1.default.string().valid(...ticketPriorities), joi_1.default.string().max(500), joi_1.default.array().items(joi_1.default.string().max(100)).max(50))
        .required(),
    metadata: joi_1.default.object().optional(),
});
exports.ticketSchemas = {
    create: joi_1.default.object({
        subject: joi_1.default.string().required().min(3).max(200).messages({
            'string.empty': 'Subject is required',
            'string.min': 'Subject must be at least 3 characters',
            'string.max': 'Subject must be less than 200 characters',
        }),
        description: joi_1.default.string().required().min(10).max(5000).messages({
            'string.empty': 'Description is required',
            'string.min': 'Description must be at least 10 characters',
        }),
        category: joi_1.default.string()
            .valid(...ticketCategories)
            .default(Ticket_1.TicketCategory.GENERAL)
            .messages({
            'any.only': `Category must be one of: ${ticketCategories.join(', ')}`,
        }),
        priority: joi_1.default.string()
            .valid(...ticketPriorities)
            .default(Ticket_1.TicketPriority.MEDIUM)
            .messages({
            'any.only': `Priority must be one of: ${ticketPriorities.join(', ')}`,
        }),
        recipientType: joi_1.default.string()
            .valid(...ticketRecipientTypes)
            .required()
            .messages({
            'any.required': 'Recipient type is required',
            'any.only': `Recipient type must be one of: ${ticketRecipientTypes.join(', ')}`,
        }),
        recipientId: joi_1.default.string()
            .max(200)
            .optional()
            .allow(null, '')
            .when('recipientType', {
            is: Ticket_1.TicketRecipientType.SPECIFIC_USER,
            then: joi_1.default.string().required().messages({
                'any.required': 'Recipient ID is required when sending to a specific user',
                'string.empty': 'Recipient ID is required when sending to a specific user',
            }),
        }),
        recipientName: joi_1.default.string()
            .max(200)
            .optional()
            .allow(null, '')
            .when('recipientType', {
            is: Ticket_1.TicketRecipientType.SPECIFIC_USER,
            then: joi_1.default.string().required().messages({
                'any.required': 'Recipient name is required when sending to a specific user',
                'string.empty': 'Recipient name is required when sending to a specific user',
            }),
        }),
        discordId: joi_1.default.string().optional(),
        creatorDiscordId: joi_1.default.string().optional(),
        email: joi_1.default.string().email().optional(),
        tags: joi_1.default.array().items(joi_1.default.string()).default([]),
        relatedRecruitmentId: joi_1.default.string().uuid().optional(),
        relatedDiplomacyId: joi_1.default.string().uuid().optional(),
        relatedApplicationId: joi_1.default.string().uuid().optional(),
    }),
    update: joi_1.default.object({
        subject: joi_1.default.string().min(3).max(200).optional(),
        description: joi_1.default.string().min(10).max(5000).optional(),
        category: joi_1.default.string()
            .valid(...ticketCategories)
            .optional(),
        priority: joi_1.default.string()
            .valid(...ticketPriorities)
            .optional(),
        status: joi_1.default.string()
            .valid(...ticketStatuses)
            .optional(),
        tags: joi_1.default.array().items(joi_1.default.string()).optional(),
        dueDate: joi_1.default.date().iso().optional(),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        category: joi_1.default.string()
            .valid(...ticketCategories)
            .optional(),
        status: joi_1.default.string()
            .valid('open', 'closed', ...ticketStatuses)
            .optional(),
        priority: joi_1.default.string()
            .valid(...ticketPriorities)
            .optional(),
        assigneeId: joi_1.default.string().optional(),
        creatorId: joi_1.default.string().optional(),
        creatorDiscordId: joi_1.default.string().optional(),
        searchTerm: joi_1.default.string().trim().max(200).optional(),
    }),
    addMessage: joi_1.default.object({
        content: joi_1.default.string().required().min(1).max(5000).messages({
            'string.empty': 'Message content is required',
        }),
        isInternal: joi_1.default.boolean().default(false),
        attachments: joi_1.default.array().items(joi_1.default.string().uri()).optional(),
    }),
    assign: joi_1.default.object({
        assigneeId: joi_1.default.string().required().messages({
            'string.empty': 'Assignee ID is required',
        }),
        assigneeName: joi_1.default.string().required().messages({
            'string.empty': 'Assignee name is required',
        }),
    }),
    resolve: joi_1.default.object({
        resolution: joi_1.default.string().required().min(10).max(5000).messages({
            'string.empty': 'Resolution is required',
            'string.min': 'Resolution must be at least 10 characters',
        }),
    }),
    feedback: joi_1.default.object({
        rating: joi_1.default.number().integer().min(1).max(5).required().messages({
            'number.min': 'Rating must be at least 1',
            'number.max': 'Rating must not exceed 5',
        }),
        feedback: joi_1.default.string().max(2000).optional(),
    }),
    createRoutingRule: joi_1.default.object({
        name: joi_1.default.string().trim().min(3).max(100).required(),
        description: joi_1.default.string().trim().max(1000).required(),
        priority: joi_1.default.number().integer().min(1).max(1000).optional(),
        conditionLogic: joi_1.default.string().valid('AND', 'OR').optional(),
        conditions: joi_1.default.array().items(routingConditionSchema).min(1).max(20).required(),
        actions: joi_1.default.array().items(routingActionSchema).min(1).max(20).required(),
    }),
    updateRoutingRule: joi_1.default.object({
        name: joi_1.default.string().trim().min(3).max(100).optional(),
        description: joi_1.default.string().trim().max(1000).optional(),
        isActive: joi_1.default.boolean().optional(),
        priority: joi_1.default.number().integer().min(1).max(1000).optional(),
        conditionLogic: joi_1.default.string().valid('AND', 'OR').optional(),
        conditions: joi_1.default.array().items(routingConditionSchema).min(1).max(20).optional(),
        actions: joi_1.default.array().items(routingActionSchema).min(1).max(20).optional(),
    }),
    testRoutingRule: joi_1.default.object({
        rule: joi_1.default.object({
            name: joi_1.default.string().trim().min(1).max(100).optional(),
            description: joi_1.default.string().trim().max(1000).optional(),
            isActive: joi_1.default.boolean().optional(),
            priority: joi_1.default.number().integer().min(1).max(1000).optional(),
            conditionLogic: joi_1.default.string().valid('AND', 'OR').optional(),
            conditions: joi_1.default.array().items(routingConditionSchema).min(1).max(20).required(),
            actions: joi_1.default.array().items(routingActionSchema).min(1).max(20).required(),
        }).required(),
        ticket: joi_1.default.object({
            category: joi_1.default.string()
                .valid(...ticketCategories)
                .required(),
            priority: joi_1.default.string()
                .valid(...ticketPriorities)
                .required(),
            subject: joi_1.default.string().required(),
            description: joi_1.default.string().required(),
            tags: joi_1.default.array().items(joi_1.default.string()).required(),
            creatorId: joi_1.default.string().required(),
            creatorDiscordId: joi_1.default.string().optional(),
            creatorEmail: joi_1.default.string().email().optional(),
        }).required(),
    }),
    routingRuleIdParam: joi_1.default.object({
        ruleId: joi_1.default.string().trim().required(),
    }),
    discordSettings: joi_1.default.object({
        enabled: joi_1.default.boolean().required(),
        channelId: joi_1.default.string().optional(),
        threadId: joi_1.default.string().optional(),
        notifyOnUpdate: joi_1.default.boolean().default(true),
        roleId: joi_1.default.string().optional(),
        webhookUrl: joi_1.default.string().uri().optional(),
    }),
};
//# sourceMappingURL=ticketSchemas.js.map