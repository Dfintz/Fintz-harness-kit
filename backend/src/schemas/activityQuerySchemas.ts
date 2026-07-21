import Joi from 'joi';

import {
  ActivityStatus,
  ActivityType,
  ActivityVisibility,
  ParticipantRole,
} from '../models/Activity';

import { pagination } from './common';

const activityTypes = Object.values(ActivityType);
const activityStatuses = Object.values(ActivityStatus);
const visibilities = Object.values(ActivityVisibility);
const _participantRoles = Object.values(ParticipantRole);

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

export const activityQuerySchemas = {
  search: pagination.keys({
    activityType: stringToArray(activityTypes),
    status: stringToArray(activityStatuses),
    visibility: Joi.string()
      .valid(...visibilities)
      .optional(),
    organizationId: Joi.string().trim().optional(),
    creatorId: Joi.string().trim().optional(),
    tags: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string()).unique(),
        Joi.string().custom((value, helpers) => {
          if (typeof value !== 'string') {
            return helpers.error('any.invalid');
          }
          const items = value
            .split(',')
            .map(v => v.trim())
            .filter(Boolean);
          return items;
        })
      )
      .optional(),
    categories: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string()).unique(),
        Joi.string().custom((value, helpers) => {
          if (typeof value !== 'string') {
            return helpers.error('any.invalid');
          }
          const items = value
            .split(',')
            .map(v => v.trim())
            .filter(Boolean);
          return items;
        })
      )
      .optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
    searchTerm: Joi.string().trim().max(200).optional(),
    isFeatured: Joi.boolean().optional(),
    isUrgent: Joi.boolean().optional(),
    withExpired: Joi.boolean().optional(),
    minParticipants: Joi.number().integer().min(0).optional(),
    maxParticipants: Joi.number().integer().min(0).optional(),
  }),

  idParam: Joi.object({
    id: Joi.string().trim().required(),
  }),
};
