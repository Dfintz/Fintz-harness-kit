"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.restoreBackupSchema = exports.scheduleIdParamSchema = exports.backupIdParamSchema = exports.listBackupsQuerySchema = exports.updateScheduleSchema = exports.configureScheduleSchema = exports.createBackupSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const Backup_1 = require("../models/Backup");
const BackupSchedule_1 = require("../models/BackupSchedule");
exports.createBackupSchema = joi_1.default.object({
    name: joi_1.default.string().trim().max(200).optional(),
    description: joi_1.default.string().trim().max(2000).optional(),
    backupType: joi_1.default.string()
        .valid(...Object.values(Backup_1.BackupType))
        .optional()
        .default(Backup_1.BackupType.FULL),
});
exports.configureScheduleSchema = joi_1.default.object({
    frequency: joi_1.default.string()
        .valid(...Object.values(BackupSchedule_1.BackupFrequency))
        .required(),
    retentionDays: joi_1.default.number().integer().min(1).max(365).optional(),
    enabled: joi_1.default.boolean().optional(),
});
exports.updateScheduleSchema = joi_1.default.object({
    frequency: joi_1.default.string()
        .valid(...Object.values(BackupSchedule_1.BackupFrequency))
        .optional(),
    retentionDays: joi_1.default.number().integer().min(1).max(365).optional(),
    enabled: joi_1.default.boolean().optional(),
}).min(1);
exports.listBackupsQuerySchema = joi_1.default.object({
    page: joi_1.default.number().integer().min(1).optional().default(1),
    limit: joi_1.default.number().integer().min(1).max(100).optional().default(20),
    status: joi_1.default.string()
        .valid(...Object.values(Backup_1.BackupStatus))
        .optional(),
    backupType: joi_1.default.string()
        .valid(...Object.values(Backup_1.BackupType))
        .optional(),
    sortBy: joi_1.default.string()
        .valid('createdAt', 'name', 'sizeBytes', 'status')
        .optional()
        .default('createdAt'),
    sortOrder: joi_1.default.string().valid('ASC', 'DESC').optional().default('DESC'),
});
exports.backupIdParamSchema = joi_1.default.object({
    backupId: joi_1.default.string().uuid().required(),
});
exports.scheduleIdParamSchema = joi_1.default.object({
    scheduleId: joi_1.default.string().uuid().required(),
});
exports.restoreBackupSchema = joi_1.default.object({
    confirm: joi_1.default.boolean().valid(true).required().messages({
        'any.only': 'You must confirm the restore operation by setting confirm to true',
    }),
});
//# sourceMappingURL=backupSchemas.js.map