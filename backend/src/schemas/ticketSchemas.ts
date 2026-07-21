/**
 * Ticket validation schemas
 */
import Joi from 'joi';

import {
  TicketCategory,
  TicketPriority,
  TicketRecipientType,
  TicketStatus,
} from '../models/Ticket';

import { paginationKeys } from './common';

// Valid enum values
const ticketCategories = Object.values(TicketCategory);
const ticketPriorities = Object.values(TicketPriority);
const ticketStatuses = Object.values(TicketStatus);
const ticketRecipientTypes = Object.values(TicketRecipientType);
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

const routingConditionSchema = Joi.object({
  field: Joi.string()
    .valid(...routingConditionFields)
    .required(),
  operator: Joi.string()
    .valid(...routingConditionOperators)
    .required(),
  value: Joi.alternatives()
    .try(Joi.string(), Joi.number(), Joi.array().items(Joi.string()))
    .required(),
});

const routingActionSchema = Joi.object({
  type: Joi.string()
    .valid(...routingActionTypes)
    .required(),
  value: Joi.alternatives()
    .try(
      Joi.string().valid(...ticketPriorities),
      Joi.string().max(500),
      Joi.array().items(Joi.string().max(100)).max(50)
    )
    .required(),
  metadata: Joi.object().optional(),
});

export const ticketSchemas = {
  // Create ticket schema
  create: Joi.object({
    subject: Joi.string().required().min(3).max(200).messages({
      'string.empty': 'Subject is required',
      'string.min': 'Subject must be at least 3 characters',
      'string.max': 'Subject must be less than 200 characters',
    }),
    description: Joi.string().required().min(10).max(5000).messages({
      'string.empty': 'Description is required',
      'string.min': 'Description must be at least 10 characters',
    }),
    category: Joi.string()
      .valid(...ticketCategories)
      .default(TicketCategory.GENERAL)
      .messages({
        'any.only': `Category must be one of: ${ticketCategories.join(', ')}`,
      }),
    priority: Joi.string()
      .valid(...ticketPriorities)
      .default(TicketPriority.MEDIUM)
      .messages({
        'any.only': `Priority must be one of: ${ticketPriorities.join(', ')}`,
      }),
    recipientType: Joi.string()
      .valid(...ticketRecipientTypes)
      .required()
      .messages({
        'any.required': 'Recipient type is required',
        'any.only': `Recipient type must be one of: ${ticketRecipientTypes.join(', ')}`,
      }),
    recipientId: Joi.string()
      .max(200)
      .optional()
      .allow(null, '')
      .when('recipientType', {
        is: TicketRecipientType.SPECIFIC_USER,
        then: Joi.string().required().messages({
          'any.required': 'Recipient ID is required when sending to a specific user',
          'string.empty': 'Recipient ID is required when sending to a specific user',
        }),
      }),
    recipientName: Joi.string()
      .max(200)
      .optional()
      .allow(null, '')
      .when('recipientType', {
        is: TicketRecipientType.SPECIFIC_USER,
        then: Joi.string().required().messages({
          'any.required': 'Recipient name is required when sending to a specific user',
          'string.empty': 'Recipient name is required when sending to a specific user',
        }),
      }),
    discordId: Joi.string().optional(),
    creatorDiscordId: Joi.string().optional(),
    email: Joi.string().email().optional(),
    tags: Joi.array().items(Joi.string()).default([]),
    relatedRecruitmentId: Joi.string().uuid().optional(),
    relatedDiplomacyId: Joi.string().uuid().optional(),
    relatedApplicationId: Joi.string().uuid().optional(),
  }),

  // Update ticket schema
  update: Joi.object({
    subject: Joi.string().min(3).max(200).optional(),
    description: Joi.string().min(10).max(5000).optional(),
    category: Joi.string()
      .valid(...ticketCategories)
      .optional(),
    priority: Joi.string()
      .valid(...ticketPriorities)
      .optional(),
    status: Joi.string()
      .valid(...ticketStatuses)
      .optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    dueDate: Joi.date().iso().optional(),
  }),

  // Query filters schema
  query: Joi.object({
    ...paginationKeys,
    category: Joi.string()
      .valid(...ticketCategories)
      .optional(),
    status: Joi.string()
      .valid('open', 'closed', ...ticketStatuses)
      .optional(),
    priority: Joi.string()
      .valid(...ticketPriorities)
      .optional(),
    assigneeId: Joi.string().optional(),
    creatorId: Joi.string().optional(),
    creatorDiscordId: Joi.string().optional(),
    searchTerm: Joi.string().trim().max(200).optional(),
  }),

  // Add message schema
  addMessage: Joi.object({
    content: Joi.string().required().min(1).max(5000).messages({
      'string.empty': 'Message content is required',
    }),
    isInternal: Joi.boolean().default(false),
    attachments: Joi.array().items(Joi.string().uri()).optional(),
  }),

  // Assign ticket schema
  assign: Joi.object({
    assigneeId: Joi.string().required().messages({
      'string.empty': 'Assignee ID is required',
    }),
    assigneeName: Joi.string().required().messages({
      'string.empty': 'Assignee name is required',
    }),
  }),

  // Resolve ticket schema
  resolve: Joi.object({
    resolution: Joi.string().required().min(10).max(5000).messages({
      'string.empty': 'Resolution is required',
      'string.min': 'Resolution must be at least 10 characters',
    }),
  }),

  // Feedback schema
  feedback: Joi.object({
    rating: Joi.number().integer().min(1).max(5).required().messages({
      'number.min': 'Rating must be at least 1',
      'number.max': 'Rating must not exceed 5',
    }),
    feedback: Joi.string().max(2000).optional(),
  }),

  // Routing rule create schema
  createRoutingRule: Joi.object({
    name: Joi.string().trim().min(3).max(100).required(),
    description: Joi.string().trim().max(1000).required(),
    priority: Joi.number().integer().min(1).max(1000).optional(),
    conditionLogic: Joi.string().valid('AND', 'OR').optional(),
    conditions: Joi.array().items(routingConditionSchema).min(1).max(20).required(),
    actions: Joi.array().items(routingActionSchema).min(1).max(20).required(),
  }),

  // Routing rule update schema
  updateRoutingRule: Joi.object({
    name: Joi.string().trim().min(3).max(100).optional(),
    description: Joi.string().trim().max(1000).optional(),
    isActive: Joi.boolean().optional(),
    priority: Joi.number().integer().min(1).max(1000).optional(),
    conditionLogic: Joi.string().valid('AND', 'OR').optional(),
    conditions: Joi.array().items(routingConditionSchema).min(1).max(20).optional(),
    actions: Joi.array().items(routingActionSchema).min(1).max(20).optional(),
  }),

  // Routing rule test schema
  testRoutingRule: Joi.object({
    rule: Joi.object({
      name: Joi.string().trim().min(1).max(100).optional(),
      description: Joi.string().trim().max(1000).optional(),
      isActive: Joi.boolean().optional(),
      priority: Joi.number().integer().min(1).max(1000).optional(),
      conditionLogic: Joi.string().valid('AND', 'OR').optional(),
      conditions: Joi.array().items(routingConditionSchema).min(1).max(20).required(),
      actions: Joi.array().items(routingActionSchema).min(1).max(20).required(),
    }).required(),
    ticket: Joi.object({
      category: Joi.string()
        .valid(...ticketCategories)
        .required(),
      priority: Joi.string()
        .valid(...ticketPriorities)
        .required(),
      subject: Joi.string().required(),
      description: Joi.string().required(),
      tags: Joi.array().items(Joi.string()).required(),
      creatorId: Joi.string().required(),
      creatorDiscordId: Joi.string().optional(),
      creatorEmail: Joi.string().email().optional(),
    }).required(),
  }),

  // Routing rule ID param schema
  routingRuleIdParam: Joi.object({
    ruleId: Joi.string().trim().required(),
  }),

  // Discord settings schema
  discordSettings: Joi.object({
    enabled: Joi.boolean().required(),
    channelId: Joi.string().optional(),
    threadId: Joi.string().optional(),
    notifyOnUpdate: Joi.boolean().default(true),
    roleId: Joi.string().optional(),
    webhookUrl: Joi.string().uri().optional(),
  }),
};
