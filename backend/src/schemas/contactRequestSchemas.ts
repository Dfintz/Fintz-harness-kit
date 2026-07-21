import Joi from 'joi';

import { MessageVisibility } from '../models/ContactRequest';

import { paginationKeys } from './common';

/**
 * Validation schemas for contact request API
 * Phase 4: Contact System for Organizations and Alliances
 */

// Valid enum values
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
const visibilityValues = Object.values(MessageVisibility);

// Sort field values
const sortByValues = ['createdAt', 'updatedAt', 'status', 'senderName', 'subject'];

export const contactRequestSchemas = {
  /**
   * Submit a contact request (requires authentication)
   */
  submitContactRequest: Joi.object({
    targetType: Joi.string()
      .valid(...targetTypeValues)
      .required(),
    organizationId: Joi.string().uuid().when('targetType', {
      is: 'organization',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    allianceId: Joi.string().when('targetType', {
      is: 'alliance',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    senderName: Joi.string().trim().min(1).max(100).required(),
    senderEmail: Joi.string().email().max(255).allow('', null).optional(),
    rsiHandle: Joi.string().trim().max(100).allow('', null).optional(),
    discordUsername: Joi.string().trim().max(100).allow('', null).optional(),
    subject: Joi.string().trim().min(1).max(255).required(),
    message: Joi.string().trim().min(10).max(5000).required(),
    contactType: Joi.string()
      .valid(...contactTypeValues)
      .optional()
      .default('general'),
    visibility: Joi.string()
      .valid(...visibilityValues)
      .optional()
      .default('all'),
    visibleToRoles: Joi.array()
      .items(Joi.string().trim().min(1).max(100))
      .min(1)
      .unique()
      .optional()
      .when('visibility', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
  }),

  /**
   * Add a reply to a contact request
   */
  addReply: Joi.object({
    message: Joi.string().trim().min(1).max(5000).required(),
  }),

  /**
   * Query parameters for listing contact requests
   */
  listContactRequestsQuery: Joi.object({
    ...paginationKeys,
    status: Joi.string()
      .valid(...contactRequestStatusValues)
      .optional(),
    statuses: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string().valid(...contactRequestStatusValues)),
        Joi.string().valid(...contactRequestStatusValues)
      )
      .optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    search: Joi.string().trim().max(100).optional(),
    sortBy: Joi.string()
      .valid(...sortByValues)
      .optional(),
    sortOrder: Joi.string().valid('ASC', 'DESC').optional(),
  }),

  /**
   * Update contact request status/notes
   */
  updateContactRequest: Joi.object({
    status: Joi.string()
      .valid(...contactRequestStatusValues)
      .optional(),
    internalNotes: Joi.string().trim().max(5000).allow('', null).optional(),
  }).or('status', 'internalNotes'),

  /**
   * Path parameter for contact request ID
   */
  contactRequestId: Joi.object({
    requestId: Joi.string().uuid().required(),
  }),

  /**
   * Path parameter for organization ID with contact request
   */
  organizationContactParams: Joi.object({
    id: Joi.string().uuid().required(),
    requestId: Joi.string().uuid().required(),
  }),

  /**
   * Path parameter for alliance ID with contact request
   */
  allianceContactParams: Joi.object({
    allianceId: Joi.string().required(),
    requestId: Joi.string().uuid().required(),
  }),
};
