/**
 * Mission Routes (API v2)
 *
 * Mission planning and lifecycle management endpoints supporting:
 * - Mission CRUD operations
 * - Status transitions with validation
 * - Participant and assignment management
 * - Objective management
 * - Fleet-linked missions
 * - Mission templates
 *
 * All routes require authentication and tenant context.
 */

import { Request, Response, Router } from 'express';

import { MissionController } from '../../controllers/missionController';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { tenantContextMiddleware } from '../../middleware/tenantContext';
import { AIFeatureType } from '../../models/AIUsageTracking';
import { missionSchemas } from '../../schemas';
import { aiGenerationSchemas } from '../../schemas/aiGenerationSchemas';
import { AIBriefingGenerationService } from '../../services/content/AIBriefingGenerationService';
import { logger } from '../../utils/logger';

const router = Router();

// Apply authentication and tenant context to all mission routes
router.use(authenticate);
router.use(tenantContextMiddleware);

// Lazy initialization to avoid EntityMetadataNotFoundError
let missionController: MissionController;
const getController = () => {
  if (!missionController) {
    missionController = new MissionController();
  }
  return missionController;
};

// Lazy AI service for status/usage routes
let aiService: AIBriefingGenerationService;
const getAIService = () => {
  if (!aiService) {
    aiService = new AIBriefingGenerationService();
  }
  return aiService;
};

// ==================== MISSION TEMPLATES (before :missionId) ====================

/**
 * GET /api/v2/missions/templates
 * Get mission templates (draft missions with no assignee)
 */
router.get('/templates', (req: Request, res: Response) => getController().getTemplates(req, res));

/**
 * GET /api/v2/missions/active
 * Get all active (planned, briefed, in_progress) missions
 */
router.get('/active', (req: Request, res: Response) => getController().getActiveMissions(req, res));

/**
 * GET /api/v2/missions/scmdb/cards
 * Search SCMDB cached mission cards by filter.
 */
router.get(
  '/scmdb/cards',
  validateSchema(missionSchemas.scmdbSearchQuery, 'query'),
  (req: Request, res: Response) => getController().searchScmdbMissionCards(req, res)
);

/**
 * POST /api/v2/missions/scmdb/import
 * Import one or multiple missions from SCMDB cached records.
 */
router.post(
  '/scmdb/import',
  validateSchema(missionSchemas.importScmdbMissions, 'body'),
  (req: Request, res: Response) => getController().importScmdbMissions(req, res)
);

/**
 * GET /api/v2/missions/scmdb/filters
 * Get available SCMDB filter options (categories and counts).
 * Requires authentication for tracking purposes (SCMDB data is global, but user access is logged).
 */
router.get('/scmdb/filters', (req: Request, res: Response) =>
  getController().getScmdbFilters(req, res)
);

/**
 * POST /api/v2/missions/scmdb/import-url
 * Import a single SCMDB mission by URL or mission ID.
 * Supports direct URL import: paste link for one-click import.
 */
router.post(
  '/scmdb/import-url',
  validateSchema(missionSchemas.importScmdbByUrl, 'body'),
  (req: Request, res: Response) => getController().importScmdbByUrl(req, res)
);

// ==================== AI STATUS & USAGE (before :missionId) ====================

/**
 * GET /api/v2/missions/ai/status
 * Check if AI briefing generation is available (configured)
 */
router.get('/ai/status', (_req: Request, res: Response) => {
  try {
    const service = getAIService();
    res.json({ available: service.isAvailable() });
  } catch {
    res.json({ available: false });
  }
});

/**
 * GET /api/v2/missions/ai/usage
 * Get AI usage statistics for the current organization
 */
router.get('/ai/usage', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const organizationId = authReq.user?.currentOrganizationId;
    if (!organizationId) {
      res.status(400).json({ error: 'Organization context required' });
      return;
    }
    const stats = await getAIService().getUsageStats(
      organizationId,
      AIFeatureType.BRIEFING_GENERATION
    );
    res.json(stats);
  } catch (error) {
    const status = (error as Error & { status?: number }).status || 500;
    logger.error('Failed to get AI usage stats', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(status).json({ error: (error as Error).message || 'Failed to get AI usage stats' });
  }
});

// ==================== MISSION CRUD ====================

/**
 * POST /api/v2/missions
 * Create a new mission
 * Request body: mission creation data
 */
router.post('/', validateSchema(missionSchemas.create, 'body'), (req: Request, res: Response) =>
  getController().createMission(req, res)
);

/**
 * GET /api/v2/missions
 * Get all missions with filtering and pagination
 * Query: status, missionType, difficulty, priority, search, etc.
 */
router.get('/', validateSchema(missionSchemas.query, 'query'), (req: Request, res: Response) =>
  getController().getAllMissions(req, res)
);

/**
 * GET /api/v2/missions/:missionId
 * Get a specific mission
 */
router.get(
  '/:missionId',
  validateSchema(missionSchemas.idParam, 'params'),
  (req: Request, res: Response) => getController().getMission(req, res)
);

/**
 * PUT /api/v2/missions/:missionId
 * Update a mission
 */
router.put(
  '/:missionId',
  validateSchema(missionSchemas.idParam, 'params'),
  validateSchema(missionSchemas.update, 'body'),
  (req: Request, res: Response) => getController().updateMission(req, res)
);

/**
 * DELETE /api/v2/missions/:missionId
 * Soft-delete a mission
 */
router.delete(
  '/:missionId',
  validateSchema(missionSchemas.idParam, 'params'),
  (req: Request, res: Response) => getController().deleteMission(req, res)
);

// ==================== STATUS & LIFECYCLE ====================

/**
 * PUT /api/v2/missions/:missionId/status
 * Transition mission status
 * Request body: { status: string }
 */
router.put(
  '/:missionId/status',
  validateSchema(missionSchemas.idParam, 'params'),
  validateSchema(missionSchemas.updateStatus, 'body'),
  (req: Request, res: Response) => getController().updateStatus(req, res)
);

/**
 * GET /api/v2/missions/:missionId/workflow
 * Get guided command workflow state for dispatch -> after-action phases
 */
router.get(
  '/:missionId/workflow',
  validateSchema(missionSchemas.idParam, 'params'),
  (req: Request, res: Response) => getController().getWorkflow(req, res)
);

/**
 * POST /api/v2/missions/:missionId/workflow/advance
 * Advance a workflow phase and apply lifecycle status changes when valid
 */
router.post(
  '/:missionId/workflow/advance',
  validateSchema(missionSchemas.idParam, 'params'),
  validateSchema(missionSchemas.advanceWorkflow, 'body'),
  (req: Request, res: Response) => getController().advanceWorkflowPhase(req, res)
);

/**
 * POST /api/v2/missions/:missionId/assign
 * Assign a user to the mission
 * Request body: { userId: string, role?: string }
 */
router.post(
  '/:missionId/assign',
  validateSchema(missionSchemas.idParam, 'params'),
  validateSchema(missionSchemas.assign, 'body'),
  (req: Request, res: Response) => getController().assignMission(req, res)
);

/**
 * POST /api/v2/missions/:missionId/complete
 * Complete or fail a mission
 * Request body: { status: 'completed' | 'failed', notes?: string }
 */
router.post(
  '/:missionId/complete',
  validateSchema(missionSchemas.idParam, 'params'),
  validateSchema(missionSchemas.complete, 'body'),
  (req: Request, res: Response) => getController().completeMission(req, res)
);

// ==================== PARTICIPANTS ====================

/**
 * GET /api/v2/missions/:missionId/participants
 * Get all participants for a mission
 */
router.get(
  '/:missionId/participants',
  validateSchema(missionSchemas.idParam, 'params'),
  (req: Request, res: Response) => getController().getParticipants(req, res)
);

/**
 * POST /api/v2/missions/:missionId/participants
 * Add a participant to a mission
 * Request body: { userId: string, role?: string }
 */
router.post(
  '/:missionId/participants',
  validateSchema(missionSchemas.idParam, 'params'),
  validateSchema(missionSchemas.addParticipant, 'body'),
  (req: Request, res: Response) => getController().addParticipant(req, res)
);

/**
 * DELETE /api/v2/missions/:missionId/participants/:userId
 * Remove a participant from a mission
 */
router.delete(
  '/:missionId/participants/:userId',
  validateSchema(missionSchemas.participantIdParam, 'params'),
  (req: Request, res: Response) => getController().removeParticipant(req, res)
);

// ==================== OBJECTIVES ====================

/**
 * POST /api/v2/missions/:missionId/objectives
 * Add an objective to a mission
 */
router.post(
  '/:missionId/objectives',
  validateSchema(missionSchemas.idParam, 'params'),
  validateSchema(missionSchemas.addObjective, 'body'),
  (req: Request, res: Response) => getController().addObjective(req, res)
);

/**
 * PUT /api/v2/missions/:missionId/objectives/:objectiveId
 * Update a specific objective
 */
router.put(
  '/:missionId/objectives/:objectiveId',
  validateSchema(missionSchemas.objectiveIdParam, 'params'),
  validateSchema(missionSchemas.updateObjective, 'body'),
  (req: Request, res: Response) => getController().updateObjective(req, res)
);

/**
 * DELETE /api/v2/missions/:missionId/objectives/:objectiveId
 * Remove an objective from a mission
 */
router.delete(
  '/:missionId/objectives/:objectiveId',
  validateSchema(missionSchemas.objectiveIdParam, 'params'),
  (req: Request, res: Response) => getController().removeObjective(req, res)
);

// ==================== AI BRIEFING GENERATION ====================

/**
 * POST /api/v2/missions/:missionId/generate-briefing
 * Generate an AI-powered briefing for a mission (non-streaming, JSON response)
 * Returns structured briefing elements
 */
router.post(
  '/:missionId/generate-briefing',
  validateSchema(missionSchemas.idParam, 'params'),
  validateSchema(aiGenerationSchemas.generateBriefing, 'body'),
  (req: Request, res: Response) => getController().generateBriefing(req, res)
);

/**
 * POST /api/v2/missions/:missionId/generate-briefing-stream
 * Generate an AI-powered briefing for a mission (SSE streaming response)
 *
 * Content-Type: text/event-stream
 * Events: data chunks via SSE, final event "done" when complete
 */
router.post(
  '/:missionId/generate-briefing-stream',
  validateSchema(missionSchemas.idParam, 'params'),
  validateSchema(aiGenerationSchemas.generateBriefingStream, 'body'),
  (req: Request, res: Response) => getController().generateBriefingStream(req, res)
);

export { router };
