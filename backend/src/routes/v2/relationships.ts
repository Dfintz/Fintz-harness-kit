/**
 * Relationships Routes (API v2)
 *
 * Comprehensive relationship management endpoints supporting:
 * - Relationship CRUD operations
 * - Interaction tracking and sentiment analysis
 * - Trust score management
 * - Relationship history and analytics
 * - Organization-level relationship management
 *
 * All routes require authentication
 */

import { Request, Response, Router } from 'express';

import { RelationshipController } from '../../controllers/relationshipController';
import { authenticate } from '../../middleware/auth';
import {
  validateCreateRelationship,
  validateRecordInteraction,
  validateTerminateRelationship,
  validateUpdateRelationship,
  validateUpdateTrustScore,
  validateUUID,
} from '../../middleware/relationshipValidation';
import { validateSchema } from '../../middleware/schemaValidation';
import {
  requireTenantContext,
  tenantContextMiddleware,
} from '../../middleware/tenantContext';
import { relationshipV2QuerySchemas } from '../../schemas';

const router = Router();

// Apply authentication to all relationship routes
router.use(authenticate);

// Tenant context middleware array for org-scoped routes
const orgAuth = [tenantContextMiddleware, requireTenantContext];

// Lazy initialization to avoid EntityMetadataNotFoundError
let relationshipController: RelationshipController;
const getController = () => {
  if (!relationshipController) {
    relationshipController = new RelationshipController();
  }
  return relationshipController;
};

// ==================== METADATA ENDPOINTS ====================

/**
 * GET /api/v2/relationships/types
 * Get all available relationship types
 * Reference data - authenticated but no org context needed
 */
router.get(
  '/types',
  validateSchema(relationshipV2QuerySchemas.typesQuery, 'query'),
  (req: Request, res: Response) => getController().getRelationshipTypes(req, res)
);

/**
 * GET /api/v2/relationships/change-types
 * Get all relationship change types
 * Reference data for tracking relationship changes
 */
router.get(
  '/change-types',
  validateSchema(relationshipV2QuerySchemas.changeTypesQuery, 'query'),
  (req: Request, res: Response) => getController().getChangeTypes(req, res)
);

/**
 * GET /api/v2/relationships/sentiments
 * Get all available interaction sentiments
 * Reference data for interaction sentiment analysis
 */
router.get(
  '/sentiments',
  validateSchema(relationshipV2QuerySchemas.sentimentsQuery, 'query'),
  (req: Request, res: Response) => getController().getInteractionSentiments(req, res)
);

// ==================== RELATIONSHIP CRUD ====================

/**
 * POST /api/v2/relationships
 * Create a new relationship
 * Request body: relationship creation data
 * Requires: validateCreateRelationship middleware
 */
router.post('/', ...orgAuth, validateCreateRelationship, (req: Request, res: Response) =>
  getController().createRelationship(req, res)
);

/**
 * GET /api/v2/relationships/:id
 * Get a specific relationship by ID
 * Requires: valid UUID for relationship ID
 */
router.get(
  '/:id',
  ...orgAuth,
  validateSchema(relationshipV2QuerySchemas.idParam, 'params'),
  validateUUID('id'),
  (req: Request, res: Response) => getController().getRelationship(req, res)
);

/**
 * PUT /api/v2/relationships/:id
 * Update a relationship
 * Requires: valid UUID and update data validation
 */
router.put(
  '/:id',
  ...orgAuth,
  validateSchema(relationshipV2QuerySchemas.idParam, 'params'),
  validateUUID('id'),
  validateUpdateRelationship,
  validateSchema(relationshipV2QuerySchemas.updateBody, 'body'),
  (req: Request, res: Response) => getController().updateRelationship(req, res)
);

/**
 * DELETE /api/v2/relationships/:id
 * Delete/terminate a relationship
 * Requires: valid UUID and termination validation
 */
router.delete(
  '/:id',
  ...orgAuth,
  validateSchema(relationshipV2QuerySchemas.idParam, 'params'),
  validateUUID('id'),
  validateTerminateRelationship,
  validateSchema(relationshipV2QuerySchemas.terminateBody, 'body'),
  (req: Request, res: Response) => getController().terminateRelationship(req, res)
);

// ==================== RELATIONSHIP HISTORY AND ANALYTICS ====================

/**
 * GET /api/v2/relationships/:id/history
 * Get complete history of relationship changes
 * Returns: chronological list of all modifications
 */
router.get(
  '/:id/history',
  ...orgAuth,
  validateSchema(relationshipV2QuerySchemas.idParam, 'params'),
  validateUUID('id'),
  validateSchema(relationshipV2QuerySchemas.historyQuery, 'query'),
  (req: Request, res: Response) => getController().getRelationshipHistory(req, res)
);

/**
 * GET /api/v2/relationships/:id/timeline
 * Get relationship timeline with key events
 * Returns: visual timeline of important milestones
 */
router.get(
  '/:id/timeline',
  ...orgAuth,
  validateSchema(relationshipV2QuerySchemas.idParam, 'params'),
  validateUUID('id'),
  validateSchema(relationshipV2QuerySchemas.timelineQuery, 'query'),
  (req: Request, res: Response) => getController().getRelationshipTimeline(req, res)
);

/**
 * GET /api/v2/relationships/:id/analytics
 * Get analytics for the relationship
 * Returns: interaction frequency, sentiment trends, engagement metrics
 */
router.get(
  '/:id/analytics',
  ...orgAuth,
  validateSchema(relationshipV2QuerySchemas.idParam, 'params'),
  validateUUID('id'),
  validateSchema(relationshipV2QuerySchemas.analyticsQuery, 'query'),
  (req: Request, res: Response) => getController().getRelationshipAnalytics(req, res)
);

/**
 * GET /api/v2/relationships/:id/sentiment-trend
 * Get sentiment trend for the relationship
 * Returns: sentiment analysis over time
 */
router.get(
  '/:id/sentiment-trend',
  ...orgAuth,
  validateSchema(relationshipV2QuerySchemas.idParam, 'params'),
  validateUUID('id'),
  validateSchema(relationshipV2QuerySchemas.sentimentTrendQuery, 'query'),
  (req: Request, res: Response) => getController().getSentimentTrend(req, res)
);

// ==================== INTERACTIONS ====================

/**
 * POST /api/v2/relationships/:id/interactions
 * Record a new interaction in the relationship
 * Request body: interaction data including sentiment, type, notes
 * Requires: valid UUID and interaction validation
 */
router.post(
  '/:id/interactions',
  ...orgAuth,
  validateUUID('id'),
  validateRecordInteraction,
  (req: Request, res: Response) => getController().recordInteraction(req, res)
);

// ==================== TRUST SCORE MANAGEMENT ====================

/**
 * POST /api/v2/relationships/:id/trust
 * Update trust score for the relationship
 * Request body: new trust score and reason
 * Requires: valid UUID and trust score validation
 */
router.post(
  '/:id/trust',
  ...orgAuth,
  validateUUID('id'),
  validateUpdateTrustScore,
  (req: Request, res: Response) => getController().updateTrustScore(req, res)
);

/**
 * GET /api/v2/relationships/:id/trust/history
 * Get trust score history for the relationship
 * Returns: chronological trust score changes
 */
router.get('/:id/trust/history', ...orgAuth, validateUUID('id'), (req: Request, res: Response) =>
  getController().getTrustHistory(req, res)
);

/**
 * GET /api/v2/relationships/:id/trust/recommendations
 * Get trust score recommendations based on interactions
 * Returns: analysis and suggestions for adjusting trust score
 */
router.get('/:id/trust/recommendations', ...orgAuth, validateUUID('id'), (req: Request, res: Response) =>
  getController().getTrustRecommendations(req, res)
);

// ==================== MUTUAL RELATIONSHIPS ====================

/**
 * POST /api/v2/relationships/:id/mutual
 * Establish mutual relationship
 * Creates reciprocal relationship if not exists
 */
router.post('/:id/mutual', ...orgAuth, validateUUID('id'), (req: Request, res: Response) =>
  getController().establishMutualRelationship(req, res)
);

// ==================== ORGANIZATION-LEVEL ENDPOINTS ====================

/**
 * GET /api/v2/relationships/organizations/:orgId/relationships
 * Get all relationships for an organization
 * Requires: valid organization UUID
 */
router.get(
  '/organizations/:orgId/relationships',
  ...orgAuth,
  validateUUID('orgId'),
  (req: Request, res: Response) => getController().getOrganizationRelationships(req, res)
);

/**
 * GET /api/v2/relationships/organizations/:orgId/relationships/health
 * Get relationship health summary for organization
 * Returns: aggregate health metrics for all org relationships
 */
router.get(
  '/organizations/:orgId/relationships/health',
  ...orgAuth,
  validateUUID('orgId'),
  (req: Request, res: Response) => getController().getRelationshipHealthSummary(req, res)
);

/**
 * GET /api/v2/relationships/organizations/:orgId/relationships/review
 * Get relationships needing review for organization
 * Returns: relationships flagged for attention based on various criteria
 */
router.get(
  '/organizations/:orgId/relationships/review',
  ...orgAuth,
  validateUUID('orgId'),
  (req: Request, res: Response) => getController().getRelationshipsNeedingReview(req, res)
);

export { router };

