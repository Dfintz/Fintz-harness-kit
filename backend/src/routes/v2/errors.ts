/**
 * Error Tracking Routes (API v2)
 *
 * Handles frontend error reports and tracks them via Application Insights
 */

import { Router } from 'express';

import { trackFrontendError } from '../../controllers/ErrorTrackingController';
import { asyncHandler } from '../../middleware/errorHandler';
import { validateSchema } from '../../middleware/schemaValidation';
import { monitoringSchemas } from '../../schemas';

const router = Router();

/**
 * @swagger
 * /api/v2/errors/track:
 *   post:
 *     summary: Track frontend error
 *     description: Receives error reports from frontend and tracks them via Application Insights
 *     tags: [Errors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - error
 *               - timestamp
 *             properties:
 *               error:
 *                 type: object
 *                 required:
 *                   - name
 *                   - message
 *                 properties:
 *                   name:
 *                     type: string
 *                   message:
 *                     type: string
 *                   stack:
 *                     type: string
 *               severity:
 *                 type: number
 *                 enum: [0, 1, 2, 3, 4]
 *               context:
 *                 type: object
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *               tags:
 *                 type: object
 *     responses:
 *       200:
 *         description: Error tracked successfully
 *       400:
 *         description: Invalid error report payload
 *       500:
 *         description: Failed to track error
 */
router.post(
  '/errors/track',
  validateSchema(monitoringSchemas.trackError, 'body'),
  asyncHandler(trackFrontendError)
);

export { router };
