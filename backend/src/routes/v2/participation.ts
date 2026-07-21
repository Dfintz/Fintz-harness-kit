/**
 * API v2 - Participation Routes — Sprint 20-E
 *
 * Unified participation endpoints exposing cross-system
 * participation summaries (teams, activities, jobs, LFG).
 *
 * All routes require authentication.
 */

import { Router } from 'express';

import { ParticipationControllerV2 } from '../../controllers/v2/participationController';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new ParticipationControllerV2();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/v2/participation/summary
 * Get participation summary for the authenticated user
 * Query: ?organizationId=xxx&systems=team,activity,job,lfg
 */
router.get('/summary', controller.getSummary.bind(controller));

/**
 * GET /api/v2/participation/users/:userId/summary
 * Get participation summary for a specific user
 * Query: ?organizationId=xxx&systems=team,activity,job,lfg
 */
router.get('/users/:userId/summary', controller.getUserSummary.bind(controller));

export { router };
