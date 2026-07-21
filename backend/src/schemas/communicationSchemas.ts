import Joi from 'joi';

import { description, id, paginationKeys } from './common';

/**
 * Communication domain validation schemas
 * Covers: notifications, notification templates, announcements, webhooks
 */

export const communicationSchemas = {
  // Create notification
  createNotification: Joi.object({
    type: Joi.string().valid('info', 'warning', 'error', 'success', 'announcement').required(),
    title: Joi.string().trim().min(1).max(200).required(),
    message: Joi.string().trim().min(1).max(5000).required(),
    recipientIds: Joi.array().items(Joi.string().uuid().trim()).max(50).optional(),
    recipientEmails: Joi.array().items(Joi.string().email()).max(50).optional(),
    channel: Joi.string().valid('discord', 'email', 'in-app', 'all').default('in-app'),
    priority: Joi.string().valid('low', 'normal', 'high', 'urgent').default('normal'),
    data: Joi.object().optional(),
  }).or('recipientIds', 'recipientEmails'),

  // Mark notifications as read
  markAsRead: Joi.object({
    notificationIds: Joi.array().items(Joi.string().uuid()).min(1).max(100).required(),
  }),

  // Notification ID param
  notificationParam: Joi.object({
    notificationId: Joi.string().uuid().required(),
  }),

  // Send bulk notification
  sendBulk: Joi.object({
    type: Joi.string().valid('info', 'warning', 'error', 'success', 'announcement').required(),
    title: Joi.string().trim().min(1).max(200).required(),
    message: Joi.string().trim().min(1).max(5000).required(),
    channel: Joi.string().valid('discord', 'email', 'in-app', 'all').default('in-app'),
    filters: Joi.object({
      roles: Joi.array().items(Joi.string().trim()).optional(),
      organizationId: Joi.string().trim().optional(),
    }).optional(),
  }),

  // Create notification template
  createTemplate: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    subject: Joi.string().trim().min(1).max(200).required(),
    body: Joi.string().trim().min(1).max(10000).required(),
    type: Joi.string().valid('email', 'discord', 'in-app').required(),
    variables: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().trim().required(),
          description: Joi.string().trim().optional(),
          defaultValue: Joi.string().trim().optional(),
          required: Joi.boolean().default(false),
        })
      )
      .optional(),
    description,
    isActive: Joi.boolean().default(true),
  }),

  // Update notification template
  updateTemplate: Joi.object({
    name: Joi.string().trim().min(1).max(100).optional(),
    subject: Joi.string().trim().min(1).max(200).optional(),
    body: Joi.string().trim().min(1).max(10000).optional(),
    type: Joi.string().valid('email', 'discord', 'in-app').optional(),
    variables: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().trim().required(),
          description: Joi.string().trim().optional(),
          defaultValue: Joi.string().trim().optional(),
          required: Joi.boolean().optional(),
        })
      )
      .optional(),
    description,
    isActive: Joi.boolean().optional(),
  }),

  // Render template
  renderTemplate: Joi.object({
    templateId: id,
    variables: Joi.object().pattern(Joi.string(), Joi.string()).required(),
  }),

  // Notification query params
  query: Joi.object({
    ...paginationKeys,
    type: Joi.string().valid('info', 'warning', 'error', 'success', 'announcement').optional(),
    channel: Joi.string().valid('discord', 'email', 'in-app').optional(),
    read: Joi.boolean().optional(),
  }),

  // Notification digest query
  digestQuery: Joi.object({
    period: Joi.string().valid('daily', 'weekly', 'monthly').default('daily'),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
  }),

  param: Joi.object({ id }),
};
