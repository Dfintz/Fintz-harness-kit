import Joi from 'joi';

import { BackupStatus, BackupType } from '../models/Backup';
import { BackupFrequency } from '../models/BackupSchedule';

// ==================== CREATE ====================

export const createBackupSchema = Joi.object({
  name: Joi.string().trim().max(200).optional(),
  description: Joi.string().trim().max(2000).optional(),
  backupType: Joi.string()
    .valid(...Object.values(BackupType))
    .optional()
    .default(BackupType.FULL),
});

// ==================== SCHEDULE ====================

export const configureScheduleSchema = Joi.object({
  frequency: Joi.string()
    .valid(...Object.values(BackupFrequency))
    .required(),
  retentionDays: Joi.number().integer().min(1).max(365).optional(),
  enabled: Joi.boolean().optional(),
});

export const updateScheduleSchema = Joi.object({
  frequency: Joi.string()
    .valid(...Object.values(BackupFrequency))
    .optional(),
  retentionDays: Joi.number().integer().min(1).max(365).optional(),
  enabled: Joi.boolean().optional(),
}).min(1);

// ==================== QUERY ====================

export const listBackupsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  status: Joi.string()
    .valid(...Object.values(BackupStatus))
    .optional(),
  backupType: Joi.string()
    .valid(...Object.values(BackupType))
    .optional(),
  sortBy: Joi.string()
    .valid('createdAt', 'name', 'sizeBytes', 'status')
    .optional()
    .default('createdAt'),
  sortOrder: Joi.string().valid('ASC', 'DESC').optional().default('DESC'),
});

// ==================== PARAMS ====================

export const backupIdParamSchema = Joi.object({
  backupId: Joi.string().uuid().required(),
});

export const scheduleIdParamSchema = Joi.object({
  scheduleId: Joi.string().uuid().required(),
});

// ==================== RESTORE ====================

export const restoreBackupSchema = Joi.object({
  confirm: Joi.boolean().valid(true).required().messages({
    'any.only': 'You must confirm the restore operation by setting confirm to true',
  }),
});
