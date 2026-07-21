/**
 * Joi validation schemas for Availability endpoints (Wave 2.4)
 */

import Joi from 'joi';

export const setAvailability = Joi.object({
  slots: Joi.array()
    .items(
      Joi.object({
        dayOfWeek: Joi.number().integer().min(0).max(6).required(),
        startMinute: Joi.number().integer().min(0).max(1439).required(),
        endMinute: Joi.number().integer().min(0).max(1439).required(),
        isRecurring: Joi.boolean().default(true),
        effectiveDate: Joi.string().isoDate().allow(null).optional(),
        expiresAt: Joi.string().isoDate().allow(null).optional(),
      })
    )
    .min(0)
    .max(168) // 7 days × 24 hours max
    .required(),
});

export const findBestTimes = Joi.object({
  durationMinutes: Joi.number().integer().min(30).max(480).required(),
  minAttendees: Joi.number().integer().min(1).max(500).required(),
});
