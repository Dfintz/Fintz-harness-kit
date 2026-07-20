"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recruitmentSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.recruitmentSchemas = {
    create: joi_1.default.object({
        organizationId: common_1.optionalId.description('Organization ID (uses current org if not provided)'),
        title: joi_1.default.string().trim().min(3).max(200).required().description('Recruitment title'),
        description: joi_1.default.string()
            .trim()
            .max(5000)
            .required()
            .description('Detailed description of the recruitment opportunity (supports Markdown)'),
        rolesNeeded: joi_1.default.array()
            .items(joi_1.default.string().trim().max(50))
            .min(1)
            .max(20)
            .required()
            .description('Array of roles needed (e.g., pilot, engineer, gunner)'),
        maxPositions: joi_1.default.number()
            .integer()
            .min(1)
            .max(1000)
            .optional()
            .description('Maximum number of positions available'),
        requirements: joi_1.default.string()
            .trim()
            .max(5000)
            .optional()
            .description('Requirements for applicants (supports Markdown)'),
        expiresAt: joi_1.default.date().iso().min('now').optional().description('When the recruitment expires'),
        bannerImageUrl: joi_1.default.string()
            .uri({ scheme: ['https'] })
            .trim()
            .max(2048)
            .optional()
            .allow('', null)
            .description('Banner image URL for the recruitment post'),
        visibility: joi_1.default.string()
            .valid('public', 'organization', 'alliance', 'private')
            .optional()
            .description('Who can see this recruitment'),
        tags: joi_1.default.array()
            .items(joi_1.default.string().trim().max(50))
            .max(10)
            .optional()
            .description('Tags for categorization'),
        screeningEnabled: joi_1.default.boolean().optional().description('Enable automatic applicant screening'),
        autoAcceptQualified: joi_1.default.boolean()
            .optional()
            .description('Auto-accept applicants who pass screening'),
        contractorRequirements: joi_1.default.object({
            minimumReputation: joi_1.default.number().min(0).max(100).optional(),
            requiredCertifications: joi_1.default.array().items(joi_1.default.string()).optional(),
            requiredShips: joi_1.default.array().items(joi_1.default.string()).optional(),
            requiredLanguages: joi_1.default.array().items(joi_1.default.string()).optional(),
            backgroundCheckRequired: joi_1.default.boolean().optional(),
            passingScore: joi_1.default.number().min(0).max(100).optional(),
        })
            .optional()
            .description('Requirements for applicant screening'),
    }),
    update: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).optional(),
        description: joi_1.default.string().trim().max(5000).optional(),
        rolesNeeded: joi_1.default.array().items(joi_1.default.string().trim().max(50)).min(1).max(20).optional(),
        maxPositions: joi_1.default.number().integer().min(1).max(1000).optional(),
        requirements: joi_1.default.string().trim().max(5000).optional().allow(''),
        expiresAt: joi_1.default.date().iso().optional().allow(null),
        bannerImageUrl: joi_1.default.string()
            .uri({ scheme: ['https'] })
            .trim()
            .max(2048)
            .optional()
            .allow('', null),
        visibility: joi_1.default.string().valid('public', 'organization', 'alliance', 'private').optional(),
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(10).optional(),
        screeningEnabled: joi_1.default.boolean().optional(),
        autoAcceptQualified: joi_1.default.boolean().optional(),
        contractorRequirements: joi_1.default.object({
            minimumReputation: joi_1.default.number().min(0).max(100).optional(),
            requiredCertifications: joi_1.default.array().items(joi_1.default.string()).optional(),
            requiredShips: joi_1.default.array().items(joi_1.default.string()).optional(),
            requiredLanguages: joi_1.default.array().items(joi_1.default.string()).optional(),
            backgroundCheckRequired: joi_1.default.boolean().optional(),
            passingScore: joi_1.default.number().min(0).max(100).optional(),
        }).optional(),
    }),
    updateStatus: joi_1.default.object({
        status: joi_1.default.string()
            .valid('open', 'closed', 'paused')
            .required()
            .description('New status for the recruitment'),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        status: joi_1.default.string()
            .valid('open', 'closed', 'paused')
            .optional()
            .description('Frontend status: open, closed, or paused'),
        organizationId: joi_1.default.string().trim().optional(),
        searchTerm: joi_1.default.string().trim().max(200).optional(),
        hasOpenSlots: joi_1.default.boolean().optional(),
        tags: joi_1.default.alternatives()
            .try(joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(10), joi_1.default.string().trim().max(50))
            .optional()
            .description('Filter by tags (single value or array)'),
    }),
    apply: joi_1.default.object({
        message: joi_1.default.string()
            .trim()
            .max(2000)
            .optional()
            .description('Cover letter or introduction message'),
        preferredRoles: joi_1.default.array()
            .items(joi_1.default.string().trim().max(50))
            .max(5)
            .optional()
            .description('Preferred roles from the available positions'),
        timezone: joi_1.default.string().trim().max(50).optional().description('Applicant timezone'),
        availablePlaytimes: joi_1.default.array()
            .items(joi_1.default.string().trim().max(50))
            .max(10)
            .optional()
            .description('When the applicant is typically available'),
        answers: joi_1.default.array()
            .items(joi_1.default.object({
            questionId: joi_1.default.string().required(),
            question: joi_1.default.string().required(),
            answer: joi_1.default.string().max(1000).required(),
        }))
            .optional()
            .description('Answers to screening questions'),
        rsiHandle: joi_1.default.string().trim().max(100).optional().description('RSI game handle'),
        discordId: joi_1.default.string().trim().max(100).optional().description('Discord ID'),
        discordUserId: joi_1.default.string().trim().max(100).optional().description('Discord ID from bot'),
        discordUsername: joi_1.default.string()
            .trim()
            .max(100)
            .optional()
            .description('Discord username from bot'),
        applicantName: joi_1.default.string()
            .trim()
            .max(100)
            .optional()
            .description('Applicant display name override'),
    }),
    applicationQuery: joi_1.default.object({
        ...common_1.paginationKeys,
        status: joi_1.default.string()
            .valid('pending', 'under_review', 'interview_scheduled', 'accepted', 'rejected', 'withdrawn')
            .optional(),
    }),
    reviewApplication: joi_1.default.object({
        action: joi_1.default.string()
            .valid('accept', 'reject', 'advance', 'interview')
            .required()
            .description('Action to take on the application'),
        notes: joi_1.default.string().trim().max(2000).optional().description('Notes about the decision'),
        rejectionReason: joi_1.default.string()
            .trim()
            .max(500)
            .optional()
            .description('Reason for rejection (if applicable)'),
        interviewScheduledAt: joi_1.default.date()
            .iso()
            .optional()
            .description('Interview date/time (if scheduling interview)'),
    }),
    applicationParams: joi_1.default.object({
        id: joi_1.default.string().trim().min(1).max(100).required().description('Recruitment activity ID'),
        applicationId: joi_1.default.string().trim().min(1).max(100).required().description('Application ID'),
    }),
};
//# sourceMappingURL=recruitmentSchemas.js.map