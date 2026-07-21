import Joi from 'joi';

import { ActivityStatus, ActivityType } from '../models/Activity';

const activityTypes = Object.values(ActivityType);
const activityStatuses = Object.values(ActivityStatus);

const stringToArray = (allowed: readonly string[]) =>
  Joi.alternatives()
    .try(
      Joi.array()
        .items(Joi.string().valid(...allowed))
        .unique(),
      Joi.string().custom((value, helpers) => {
        if (typeof value !== 'string') {
          return helpers.error('any.invalid');
        }
        const items = value
          .split(',')
          .map(v => v.trim())
          .filter(Boolean);

        const { error, value: validated } = Joi.array()
          .items(Joi.string().valid(...allowed))
          .unique()
          .validate(items, { convert: true });

        if (error) {
          return helpers.error('any.invalid');
        }

        return validated;
      })
    )
    .optional();

const conflictOptions = Joi.object({
  includeTypes: stringToArray(activityTypes),
  excludeTypes: stringToArray(activityTypes),
  includeStatuses: stringToArray(activityStatuses),
  excludeStatuses: stringToArray(activityStatuses),
  userId: Joi.string().trim().optional(),
  bufferMinutes: Joi.number().integer().min(0).max(1440).optional(),
  adjacentThresholdMinutes: Joi.number().integer().min(0).max(120).optional(),
  skipSuggestions: Joi.boolean().optional(),
}).optional();

export const eventConflictSchemas = {
  checkConflictsBody: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(),
    excludeActivityId: Joi.string().trim().optional(),
    options: conflictOptions,
  }),

  activityParams: Joi.object({
    activityId: Joi.string().trim().required(),
  }),

  userParams: Joi.object({
    userId: Joi.string().trim().required(),
  }),

  rangeQuery: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
    includeTypes: stringToArray(activityTypes),
    excludeTypes: stringToArray(activityTypes),
  }),

  optionsQuery: Joi.object({
    includeTypes: stringToArray(activityTypes),
    excludeTypes: stringToArray(activityTypes),
    bufferMinutes: Joi.number().integer().min(0).max(1440).optional(),
  }),
};
