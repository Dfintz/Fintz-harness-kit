"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.announcementSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const Announcement_1 = require("../models/Announcement");
const common_1 = require("./common");
const announcementStatuses = Object.values(Announcement_1.AnnouncementStatus);
const announcementTargetTypes = Object.values(Announcement_1.AnnouncementTargetType);
const embedFieldSchema = joi_1.default.object({
    name: joi_1.default.string().required().max(256).messages({
        'string.empty': 'Field name is required',
        'string.max': 'Field name must be less than 256 characters',
    }),
    value: joi_1.default.string().required().max(1024).messages({
        'string.empty': 'Field value is required',
        'string.max': 'Field value must be less than 1024 characters',
    }),
    inline: joi_1.default.boolean().optional().default(false),
});
const embedConfigSchema = joi_1.default.object({
    color: joi_1.default.string()
        .pattern(/^#[0-9A-Fa-f]{6}$/)
        .optional()
        .messages({
        'string.pattern.base': 'Color must be a valid hex color (e.g., #0099FF)',
    }),
    thumbnailUrl: joi_1.default.string().uri().optional().messages({
        'string.uri': 'Thumbnail URL must be a valid URL',
    }),
    imageUrl: joi_1.default.string().uri().optional().messages({
        'string.uri': 'Image URL must be a valid URL',
    }),
    footerText: joi_1.default.string().max(2048).optional().messages({
        'string.max': 'Footer text must be less than 2048 characters',
    }),
    footerIconUrl: joi_1.default.string().uri().optional().messages({
        'string.uri': 'Footer icon URL must be a valid URL',
    }),
    authorName: joi_1.default.string().max(256).optional().messages({
        'string.max': 'Author name must be less than 256 characters',
    }),
    authorIconUrl: joi_1.default.string().uri().optional().messages({
        'string.uri': 'Author icon URL must be a valid URL',
    }),
    authorUrl: joi_1.default.string().uri().optional().messages({
        'string.uri': 'Author URL must be a valid URL',
    }),
    timestamp: joi_1.default.boolean().optional().default(false),
    fields: joi_1.default.array().items(embedFieldSchema).max(25).optional().messages({
        'array.max': 'Maximum of 25 fields allowed',
    }),
});
exports.announcementSchemas = {
    create: joi_1.default.object({
        title: joi_1.default.string().required().min(1).max(256).messages({
            'string.empty': 'Title is required',
            'string.min': 'Title must be at least 1 character',
            'string.max': 'Title must be less than 256 characters',
        }),
        content: joi_1.default.string().required().min(1).max(4096).messages({
            'string.empty': 'Content is required',
            'string.min': 'Content must be at least 1 character',
            'string.max': 'Content must be less than 4096 characters',
        }),
        embedConfig: embedConfigSchema.optional(),
        targetType: joi_1.default.string()
            .valid(...announcementTargetTypes)
            .default(Announcement_1.AnnouncementTargetType.SINGLE)
            .messages({
            'any.only': `Target type must be one of: ${announcementTargetTypes.join(', ')}`,
        }),
        targetIds: joi_1.default.array().items(joi_1.default.string()).optional(),
        scheduledAt: joi_1.default.date().iso().greater('now').optional().messages({
            'date.greater': 'Scheduled time must be in the future',
        }),
    }),
    update: joi_1.default.object({
        title: joi_1.default.string().min(1).max(256).optional(),
        content: joi_1.default.string().min(1).max(4096).optional(),
        embedConfig: embedConfigSchema.optional(),
        targetType: joi_1.default.string()
            .valid(...announcementTargetTypes)
            .optional(),
        targetIds: joi_1.default.array().items(joi_1.default.string()).optional(),
        scheduledAt: joi_1.default.date().iso().optional(),
        status: joi_1.default.string()
            .valid(...announcementStatuses)
            .optional()
            .messages({
            'any.only': `Status must be one of: ${announcementStatuses.join(', ')}`,
        }),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        status: joi_1.default.string()
            .valid(...announcementStatuses)
            .optional(),
        targetType: joi_1.default.string()
            .valid(...announcementTargetTypes)
            .optional(),
        createdBy: joi_1.default.string().optional(),
    }),
    send: joi_1.default.object({
        channelId: joi_1.default.string().required().messages({
            'string.empty': 'Channel ID is required',
        }),
    }),
    embedConfig: embedConfigSchema,
    createTemplate: joi_1.default.object({
        name: joi_1.default.string().required().min(1).max(100).messages({
            'string.empty': 'Template name is required',
            'string.min': 'Template name must be at least 1 character',
            'string.max': 'Template name must be less than 100 characters',
        }),
        title: joi_1.default.string().max(256).optional().messages({
            'string.max': 'Title must be less than 256 characters',
        }),
        content: joi_1.default.string().required().min(1).max(4096).messages({
            'string.empty': 'Content is required',
            'string.min': 'Content must be at least 1 character',
            'string.max': 'Content must be less than 4096 characters',
        }),
        embedConfig: embedConfigSchema.optional(),
        isGlobal: joi_1.default.boolean().optional().default(false),
    }),
    updateTemplate: joi_1.default.object({
        name: joi_1.default.string().min(1).max(100).optional(),
        title: joi_1.default.string().max(256).optional().allow(null),
        content: joi_1.default.string().min(1).max(4096).optional(),
        embedConfig: embedConfigSchema.optional(),
    }),
    queryTemplates: joi_1.default.object({
        ...common_1.paginationKeys,
        isGlobal: joi_1.default.boolean().optional(),
        createdBy: joi_1.default.string().optional(),
    }),
    createFromTemplate: joi_1.default.object({
        templateId: joi_1.default.string().uuid().required().messages({
            'string.empty': 'Template ID is required',
            'string.guid': 'Template ID must be a valid UUID',
        }),
        title: joi_1.default.string().max(256).optional(),
        content: joi_1.default.string().max(4096).optional(),
        embedConfig: embedConfigSchema.optional(),
    }),
    globalBroadcast: joi_1.default.object({
        channelName: joi_1.default.string().max(100).optional().default('announcements').messages({
            'string.max': 'Channel name must be less than 100 characters',
        }),
        confirmation: joi_1.default.boolean().valid(true).required().messages({
            'any.only': 'You must confirm the global broadcast by setting confirmation to true',
        }),
    }),
};
//# sourceMappingURL=announcementSchemas.js.map