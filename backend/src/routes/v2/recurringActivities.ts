/**
 * Recurring Activities Routes V2
 * Handles recurring event/activity management endpoints
 */

import { Router } from 'express';

import { RecurringActivityControllerV2 } from '../../controllers/v2/recurringActivityController';
import { authenticateToken } from '../../middleware/auth';

const router = Router();

// Lazy initialization
let recurringActivityController: RecurringActivityControllerV2;
const getController = (): RecurringActivityControllerV2 => {
  if (!recurringActivityController) {
    recurringActivityController = new RecurringActivityControllerV2();
  }
  return recurringActivityController;
};

/**
 * POST /api/v2/recurring-activities/next-occurrence
 * Calculate next occurrence for a recurrence rule
 */
router.post('/recurring-activities/next-occurrence', authenticateToken, (req, res, next) =>
  getController().calculateNextOccurrence(req, res).catch(next)
);

/**
 * POST /api/v2/recurring-activities/occurrences
 * Generate multiple occurrences for a recurrence rule
 */
router.post('/recurring-activities/occurrences', authenticateToken, (req, res, next) =>
  getController().generateOccurrences(req, res).catch(next)
);

/**
 * POST /api/v2/recurring-activities/parse
 * Parse a human-readable recurrence string
 */
router.post('/recurring-activities/parse', authenticateToken, (req, res, next) =>
  getController().parseRecurrenceString(req, res).catch(next)
);

/**
 * POST /api/v2/recurring-activities/format
 * Format a recurrence rule as human-readable string
 */
router.post('/recurring-activities/format', authenticateToken, (req, res, next) =>
  getController().formatRecurrenceRule(req, res).catch(next)
);

/**
 * POST /api/v2/recurring-activities/create-instances
 * Create recurring activity instances from a template
 */
router.post('/recurring-activities/create-instances', authenticateToken, (req, res, next) =>
  getController().createRecurringInstances(req, res).catch(next)
);

/**
 * POST /api/v2/recurring-activities/preview
 * Preview occurrences for a potential recurring activity
 */
router.post('/recurring-activities/preview', authenticateToken, (req, res, next) =>
  getController().previewRecurringActivity(req, res).catch(next)
);

/**
 * GET /api/v2/recurring-activities/frequencies
 * Get available recurrence frequencies
 */
router.get('/recurring-activities/frequencies', authenticateToken, (req, res, next) =>
  getController().getFrequencies(req, res).catch(next)
);

export { router };
