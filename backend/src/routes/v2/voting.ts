import { Router } from 'express';

import { PollController } from '../../controllers/pollController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { pollSchemas } from '../../schemas/pollSchemas';

const router = Router();

// Lazy initialization to avoid circular dependency issues
let pollController: PollController;
const getController = () => {
  if (!pollController) {
    pollController = new PollController();
  }
  return pollController;
};

// ==================== VOTING & POLLS ====================

// All poll routes require authentication + org context
const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

/**
 * GET /api/v2/voting/polls
 * List all polls for the organization
 */
router.get('/polls', ...orgAuth, validateSchema(pollSchemas.query, 'query'), (req, res) =>
  getController().listPolls(req, res)
);

/**
 * POST /api/v2/voting/polls
 * Create a new poll
 */
router.post('/polls', ...orgAuth, validateSchema(pollSchemas.create, 'body'), (req, res) =>
  getController().createPoll(req, res)
);

/**
 * GET /api/v2/voting/polls/:pollId
 * Get a specific poll
 */
router.get('/polls/:pollId', ...orgAuth, validateSchema(pollSchemas.param, 'params'), (req, res) =>
  getController().getPoll(req, res)
);

/**
 * PUT /api/v2/voting/polls/:pollId
 * Update a poll
 */
router.put(
  '/polls/:pollId',
  ...orgAuth,
  validateSchema(pollSchemas.param, 'params'),
  validateSchema(pollSchemas.update, 'body'),
  (req, res) => getController().updatePoll(req, res)
);

/**
 * DELETE /api/v2/voting/polls/:pollId
 * Delete a poll
 */
router.delete(
  '/polls/:pollId',
  ...orgAuth,
  validateSchema(pollSchemas.param, 'params'),
  (req, res) => getController().deletePoll(req, res)
);

/**
 * POST /api/v2/voting/polls/:pollId/vote
 * Submit vote(s) on a poll
 */
router.post(
  '/polls/:pollId/vote',
  ...orgAuth,
  validateSchema(pollSchemas.param, 'params'),
  validateSchema(pollSchemas.vote, 'body'),
  (req, res) => getController().castVote(req, res)
);

/**
 * GET /api/v2/voting/polls/:pollId/results
 * Get poll results
 */
router.get(
  '/polls/:pollId/results',
  ...orgAuth,
  validateSchema(pollSchemas.param, 'params'),
  (req, res) => getController().getResults(req, res)
);

/**
 * POST /api/v2/voting/polls/:pollId/close
 * Close a poll
 */
router.post(
  '/polls/:pollId/close',
  ...orgAuth,
  validateSchema(pollSchemas.param, 'params'),
  (req, res) => getController().closePoll(req, res)
);

// ==================== DISCORD MIRROR ROUTES ====================

/**
 * POST /api/v2/voting/polls/:pollId/mirrors
 * Mirror a poll to a Discord guild channel
 */
router.post(
  '/polls/:pollId/mirrors',
  ...orgAuth,
  validateSchema(pollSchemas.param, 'params'),
  validateSchema(pollSchemas.mirrorToGuild, 'body'),
  (req, res) => getController().mirrorToGuild(req, res)
);

/**
 * POST /api/v2/voting/polls/:pollId/mirrors/federation
 * Mirror a poll to all Discord guilds in a federation
 */
router.post(
  '/polls/:pollId/mirrors/federation',
  ...orgAuth,
  validateSchema(pollSchemas.param, 'params'),
  validateSchema(pollSchemas.mirrorToFederation, 'body'),
  (req, res) => getController().mirrorToFederation(req, res)
);

/**
 * GET /api/v2/voting/polls/:pollId/mirrors
 * List all Discord mirrors for a poll
 */
router.get(
  '/polls/:pollId/mirrors',
  ...orgAuth,
  validateSchema(pollSchemas.param, 'params'),
  (req, res) => getController().listMirrors(req, res)
);

/**
 * DELETE /api/v2/voting/polls/:pollId/mirrors/:mirrorId
 * Delete a specific Discord mirror
 */
router.delete(
  '/polls/:pollId/mirrors/:mirrorId',
  ...orgAuth,
  validateSchema(pollSchemas.mirrorParam, 'params'),
  (req, res) => getController().deleteMirror(req, res)
);

export { router };
