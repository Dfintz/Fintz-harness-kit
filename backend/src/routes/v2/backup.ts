import { Router } from 'express';

import { BackupController } from '../../controllers/backupController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import {
  backupIdParamSchema,
  configureScheduleSchema,
  createBackupSchema,
  listBackupsQuerySchema,
  restoreBackupSchema,
  updateScheduleSchema,
} from '../../schemas/backupSchemas';

const router = Router();

// Lazy initialization to avoid circular dependency issues
let backupController: BackupController;
const getController = () => {
  if (!backupController) {
    backupController = new BackupController();
  }
  return backupController;
};

// ==================== BACKUP & RECOVERY ====================

// All backup routes require authentication + org context
const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

/**
 * GET /api/v2/backup/status
 * Get backup status overview
 */
router.get('/status', ...orgAuth, (req, res) => getController().getStatus(req, res));

/**
 * POST /api/v2/backup/create
 * Create manual backup
 */
router.post('/create', ...orgAuth, validateSchema(createBackupSchema, 'body'), (req, res) =>
  getController().createBackup(req, res)
);

/**
 * GET /api/v2/backup/list
 * List available backups
 */
router.get('/list', ...orgAuth, validateSchema(listBackupsQuerySchema, 'query'), (req, res) =>
  getController().listBackups(req, res)
);

/**
 * GET /api/v2/backup/:backupId/download
 * Get download URL for a backup
 */
router.get(
  '/:backupId/download',
  ...orgAuth,
  validateSchema(backupIdParamSchema, 'params'),
  (req, res) => getController().downloadBackup(req, res)
);

/**
 * POST /api/v2/backup/:backupId/restore
 * Restore from backup
 */
router.post(
  '/:backupId/restore',
  ...orgAuth,
  validateSchema(backupIdParamSchema, 'params'),
  validateSchema(restoreBackupSchema, 'body'),
  (req, res) => getController().restoreBackup(req, res)
);

/**
 * DELETE /api/v2/backup/:backupId
 * Delete backup
 */
router.delete('/:backupId', ...orgAuth, validateSchema(backupIdParamSchema, 'params'), (req, res) =>
  getController().deleteBackup(req, res)
);

/**
 * GET /api/v2/backup/schedule
 * Get current backup schedule
 */
router.get('/schedule', ...orgAuth, (req, res) => getController().getSchedule(req, res));

/**
 * POST /api/v2/backup/schedule
 * Configure backup schedule
 */
router.post('/schedule', ...orgAuth, validateSchema(configureScheduleSchema, 'body'), (req, res) =>
  getController().configureSchedule(req, res)
);

/**
 * PUT /api/v2/backup/schedule/:scheduleId
 * Update backup schedule
 */
router.put(
  '/schedule/:scheduleId',
  ...orgAuth,
  validateSchema(updateScheduleSchema, 'body'),
  (req, res) => getController().updateSchedule(req, res)
);

export { router };
