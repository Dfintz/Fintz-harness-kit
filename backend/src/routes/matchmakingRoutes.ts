import express from 'express';

import { matchmakingController } from '../controllers/matchmakingController';
import { authenticateToken } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { socialSchemas } from '../schemas';

const router = express.Router();

/**
 * Matchmaking Routes
 * All routes require authentication
 */

// Get enum values for preferences
router.get('/enums', authenticateToken, (req, res) => matchmakingController.getEnums(req, res));

// Get current user's preferences
router.get('/preferences', authenticateToken, (req, res) =>
  matchmakingController.getPreferences(req, res)
);

// Set or update preferences
router.post(
  '/preferences',
  authenticateToken,
  validateSchema(socialSchemas.setPreferences, 'body'),
  (req, res) => matchmakingController.setPreferences(req, res)
);

// Find matching sessions
router.get(
  '/find',
  authenticateToken,
  validateSchema(socialSchemas.findMatchesQuery, 'query'),
  (req, res) => matchmakingController.findMatches(req, res)
);

// Track session join
router.post(
  '/track',
  authenticateToken,
  validateSchema(socialSchemas.trackJoin, 'body'),
  (req, res) => matchmakingController.trackJoin(req, res)
);

// Get analytics
router.get('/analytics', authenticateToken, (req, res) =>
  matchmakingController.getAnalytics(req, res)
);

export { router };
