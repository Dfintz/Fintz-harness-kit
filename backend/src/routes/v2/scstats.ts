/**
 * API v2 — SCStats Routes
 *
 * Wave 2.5 — SCStats Integration
 *
 * Endpoints for importing, retrieving, and deleting SCStats gameplay data.
 * Supports both JSON imports and CSV imports from the SCStats desktop app.
 */

import { Router } from 'express';
import multer from 'multer';

import { scstatsController } from '../../controllers/scstatsController';
import { authenticate } from '../../middleware/auth';
import { tenantContextMiddleware } from '../../middleware/tenantContext';

const jsonUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  },
});

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per file
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

const logUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per file
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'text/plain' ||
      file.mimetype === 'application/octet-stream' ||
      file.originalname.endsWith('.log')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .log files are allowed'));
    }
  },
});

const csvFields = csvUpload.fields([
  { name: 'playtime', maxCount: 1 },
  { name: 'loadoutTop', maxCount: 1 },
  { name: 'loadoutDetail', maxCount: 1 },
  { name: 'purchases', maxCount: 1 },
  { name: 'ships', maxCount: 1 },
]);

const router = Router();

// ---------------------------------------------------------------------------
// JSON import (legacy)
// ---------------------------------------------------------------------------

// Import SCStats JSON export
router.post(
  '/users/:userId/import',
  authenticate,
  jsonUpload.single('file'),
  scstatsController.importSCStats.bind(scstatsController)
);

// ---------------------------------------------------------------------------
// CSV import (SCStats desktop app exports)
// ---------------------------------------------------------------------------

// Import SCStats CSV exports
router.post(
  '/users/:userId/csv-import',
  authenticate,
  csvFields,
  scstatsController.importCsvData.bind(scstatsController)
);

// Import SCStats data directly from Star Citizen log files
router.post(
  '/users/:userId/log-import',
  authenticate,
  logUpload.array('logs', 30),
  scstatsController.importLogData.bind(scstatsController)
);

// Get CSV-imported SCStats data
router.get(
  '/users/:userId/csv',
  authenticate,
  scstatsController.getCsvData.bind(scstatsController)
);

// Delete CSV-imported SCStats data (GDPR)
router.delete(
  '/users/:userId/csv',
  authenticate,
  scstatsController.deleteCsvData.bind(scstatsController)
);

// ---------------------------------------------------------------------------
// Shared endpoints
// ---------------------------------------------------------------------------

// Get SCStats data for user (JSON import)
router.get('/users/:userId', authenticate, scstatsController.getSCStats.bind(scstatsController));

// Delete SCStats data (GDPR - JSON import)
router.delete(
  '/users/:userId',
  authenticate,
  scstatsController.deleteSCStats.bind(scstatsController)
);

// Get organization SCStats analytics (authenticated members only)
router.get(
  '/organizations/:organizationId/analytics',
  authenticate,
  tenantContextMiddleware,
  scstatsController.getOrgAnalytics.bind(scstatsController)
);

// Get organization SCStats analytics (public — no auth required)
router.get(
  '/organizations/:organizationId/analytics/public',
  scstatsController.getPublicOrgAnalytics.bind(scstatsController)
);

export { router };

