import Joi from 'joi';

import { optionalId, paginationKeys } from './common';

/**
 * Recruitment validation schemas
 * These schemas support the dedicated /api/recruitments endpoints
 * that wrap the unified Activity API for recruitment-specific operations
 */

export const recruitmentSchemas = {
  // Create recruitment
  create: Joi.object({
    organizationId: optionalId.description('Organization ID (uses current org if not provided)'),
    title: Joi.string().trim().min(3).max(200).required().description('Recruitment title'),
    description: Joi.string()
      .trim()
      .max(5000)
      .required()
      .description('Detailed description of the recruitment opportunity (supports Markdown)'),
    rolesNeeded: Joi.array()
      .items(Joi.string().trim().max(50))
      .min(1)
      .max(20)
      .required()
      .description('Array of roles needed (e.g., pilot, engineer, gunner)'),
    maxPositions: Joi.number()
      .integer()
      .min(1)
      .max(1000)
      .optional()
      .description('Maximum number of positions available'),
    requirements: Joi.string()
      .trim()
      .max(5000)
      .optional()
      .description('Requirements for applicants (supports Markdown)'),
    expiresAt: Joi.date().iso().min('now').optional().description('When the recruitment expires'),
    bannerImageUrl: Joi.string()
      .uri({ scheme: ['https'] })
      .trim()
      .max(2048)
      .optional()
      .allow('', null)
      .description('Banner image URL for the recruitment post'),
    visibility: Joi.string()
      .valid('public', 'organization', 'alliance', 'private')
      .optional()
      .description('Who can see this recruitment'),
    tags: Joi.array()
      .items(Joi.string().trim().max(50))
      .max(10)
      .optional()
      .description('Tags for categorization'),
    screeningEnabled: Joi.boolean().optional().description('Enable automatic applicant screening'),
    autoAcceptQualified: Joi.boolean()
      .optional()
      .description('Auto-accept applicants who pass screening'),
    contractorRequirements: Joi.object({
      minimumReputation: Joi.number().min(0).max(100).optional(),
      requiredCertifications: Joi.array().items(Joi.string()).optional(),
      requiredShips: Joi.array().items(Joi.string()).optional(),
      requiredLanguages: Joi.array().items(Joi.string()).optional(),
      backgroundCheckRequired: Joi.boolean().optional(),
      passingScore: Joi.number().min(0).max(100).optional(),
    })
      .optional()
      .description('Requirements for applicant screening'),
  }),

  // Update recruitment
  update: Joi.object({
    title: Joi.string().trim().min(3).max(200).optional(),
    description: Joi.string().trim().max(5000).optional(),
    rolesNeeded: Joi.array().items(Joi.string().trim().max(50)).min(1).max(20).optional(),
    maxPositions: Joi.number().integer().min(1).max(1000).optional(),
    requirements: Joi.string().trim().max(5000).optional().allow(''),
    expiresAt: Joi.date().iso().optional().allow(null),
    bannerImageUrl: Joi.string()
      .uri({ scheme: ['https'] })
      .trim()
      .max(2048)
      .optional()
      .allow('', null),
    visibility: Joi.string().valid('public', 'organization', 'alliance', 'private').optional(),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(10).optional(),
    screeningEnabled: Joi.boolean().optional(),
    autoAcceptQualified: Joi.boolean().optional(),
    contractorRequirements: Joi.object({
      minimumReputation: Joi.number().min(0).max(100).optional(),
      requiredCertifications: Joi.array().items(Joi.string()).optional(),
      requiredShips: Joi.array().items(Joi.string()).optional(),
      requiredLanguages: Joi.array().items(Joi.string()).optional(),
      backgroundCheckRequired: Joi.boolean().optional(),
      passingScore: Joi.number().min(0).max(100).optional(),
    }).optional(),
  }),

  // Update status
  updateStatus: Joi.object({
    status: Joi.string()
      .valid('open', 'closed', 'paused')
      .required()
      .description('New status for the recruitment'),
  }),

  // Query/filter recruitments
  query: Joi.object({
    ...paginationKeys,
    status: Joi.string()
      .valid('open', 'closed', 'paused')
      .optional()
      .description('Frontend status: open, closed, or paused'),
    organizationId: Joi.string().trim().optional(),
    searchTerm: Joi.string().trim().max(200).optional(),
    hasOpenSlots: Joi.boolean().optional(),
    tags: Joi.alternatives()
      .try(Joi.array().items(Joi.string().trim().max(50)).max(10), Joi.string().trim().max(50))
      .optional()
      .description('Filter by tags (single value or array)'),
  }),

  // Submit application
  apply: Joi.object({
    message: Joi.string()
      .trim()
      .max(2000)
      .optional()
      .description('Cover letter or introduction message'),
    preferredRoles: Joi.array()
      .items(Joi.string().trim().max(50))
      .max(5)
      .optional()
      .description('Preferred roles from the available positions'),
    timezone: Joi.string().trim().max(50).optional().description('Applicant timezone'),
    availablePlaytimes: Joi.array()
      .items(Joi.string().trim().max(50))
      .max(10)
      .optional()
      .description('When the applicant is typically available'),
    answers: Joi.array()
      .items(
        Joi.object({
          questionId: Joi.string().required(),
          question: Joi.string().required(),
          answer: Joi.string().max(1000).required(),
        })
      )
      .optional()
      .description('Answers to screening questions'),
    rsiHandle: Joi.string().trim().max(100).optional().description('RSI game handle'),
    discordId: Joi.string().trim().max(100).optional().description('Discord ID'),
    discordUserId: Joi.string().trim().max(100).optional().description('Discord ID from bot'),
    discordUsername: Joi.string()
      .trim()
      .max(100)
      .optional()
      .description('Discord username from bot'),
    applicantName: Joi.string()
      .trim()
      .max(100)
      .optional()
      .description('Applicant display name override'),
  }),

  // Query applications
  applicationQuery: Joi.object({
    ...paginationKeys,
    status: Joi.string()
      .valid('pending', 'under_review', 'interview_scheduled', 'accepted', 'rejected', 'withdrawn')
      .optional(),
  }),

  // Review application (accept/reject/advance/interview)
  reviewApplication: Joi.object({
    action: Joi.string()
      .valid('accept', 'reject', 'advance', 'interview')
      .required()
      .description('Action to take on the application'),
    notes: Joi.string().trim().max(2000).optional().description('Notes about the decision'),
    rejectionReason: Joi.string()
      .trim()
      .max(500)
      .optional()
      .description('Reason for rejection (if applicable)'),
    interviewScheduledAt: Joi.date()
      .iso()
      .optional()
      .description('Interview date/time (if scheduling interview)'),
  }),

  // Param schemas for nested routes
  applicationParams: Joi.object({
    id: Joi.string().trim().min(1).max(100).required().description('Recruitment activity ID'),
    applicationId: Joi.string().trim().min(1).max(100).required().description('Application ID'),
  }),
};
