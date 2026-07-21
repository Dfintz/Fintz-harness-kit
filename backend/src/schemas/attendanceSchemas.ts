import Joi from 'joi';

import { id, notes, paginationKeys } from './common';

/**
 * Attendance Validation Schemas
 *
 * Validation for attendance tracking and confirmation endpoints
 */

export const attendanceSchemas = {
  // Initialize attendance tracking
  initialize: Joi.object({
    participantUserIds: Joi.array().items(id).min(1).max(200).optional(),
    sendNotifications: Joi.boolean().default(true),
    confirmationDeadline: Joi.date().iso().optional().allow(null),
  }),

  // Confirm attendance
  confirm: Joi.object({
    userId: id.optional(), // Defaults to authenticated user
    attendanceType: Joi.string().valid('in_person', 'virtual', 'remote').default('in_person'),
    arrivalTime: Joi.date().iso().optional().allow(null),
    notes,
  }),

  // Record detailed attendance
  record: Joi.object({
    userId: id,
    status: Joi.string()
      .valid('confirmed', 'attended', 'partial', 'late', 'left_early', 'no_show', 'excused')
      .required(),
    attendanceType: Joi.string().valid('in_person', 'virtual', 'remote').default('in_person'),
    arrivalTime: Joi.date().iso().optional().allow(null),
    departureTime: Joi.date().iso().optional().allow(null),
    durationMinutes: Joi.number().integer().min(0).optional(),
    notes,
  }),

  // Mark no-show
  noShow: Joi.object({
    userId: id,
    reason: Joi.string().trim().max(500).optional(),
    isExcused: Joi.boolean().default(false),
  }),

  // Add performance rating
  rating: Joi.object({
    performanceRating: Joi.number().min(1).max(5).required(),
    feedback: Joi.string().trim().max(1000).optional(),
    strengths: Joi.array().items(Joi.string().trim().max(100)).max(10).optional(),
    areasForImprovement: Joi.array().items(Joi.string().trim().max(100)).max(10).optional(),
  }),

  // Query params for history
  historyQuery: Joi.object({
    ...paginationKeys,
    status: Joi.string()
      .valid('confirmed', 'attended', 'partial', 'late', 'left_early', 'no_show', 'excused')
      .optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
  }),
};
