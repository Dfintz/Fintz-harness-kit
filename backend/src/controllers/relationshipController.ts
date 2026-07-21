import { Request, Response } from 'express';

import { RelationshipType } from '../models/OrganizationRelationship';
import { ChangeType, InteractionSentiment } from '../models/RelationshipHistory';
import { RelationshipService } from '../services/social';
import { ForbiddenError, NotFoundError } from '../utils/apiErrors';

import { BaseController } from './BaseController';

/** Request with authenticated user context */
type UserContextRequest = Request & {
  user?: { id: string; username: string };
  tenantContext?: { organizationId: string; userId: string };
};

/**
 * Organization relationship controller
 * Extends BaseController for standardized error handling
 *
 * Now uses the consolidated RelationshipService which includes:
 * - Relationship CRUD operations
 * - History tracking (formerly RelationshipHistoryService)
 * - Trust score management (formerly TrustScoreService)
 */
export class RelationshipController extends BaseController {
  private readonly relationshipService: RelationshipService;

  constructor() {
    super();
    this.relationshipService = new RelationshipService();
  }

  /**
   * Create a new relationship
   * POST /api/relationships
   */
  createRelationship = async (req: Request, res: Response) => {
    await this.execute(req, res, async () => {
      const userReq = req as UserContextRequest;
      const tenantOrgId = userReq.tenantContext?.organizationId;

      const {
        targetOrganizationId,
        type,
        status,
        description,
        notes,
        tags,
        contactName,
        contactRole,
        contactEmail,
        metadata,
      } = req.body;

      // Use tenant context org — never allow client-supplied organizationId
      const organizationId = tenantOrgId;
      if (!organizationId) {
        throw new ForbiddenError('Organization context required');
      }

      // Get actor info from authenticated user
      const actorId = userReq.user?.id;
      const actorName = userReq.user?.username;

      const relationship = await this.relationshipService.createRelationship({
        organizationId,
        targetOrganizationId,
        type,
        status,
        description,
        notes,
        tags,
        contactName,
        contactRole,
        contactEmail,
        establishedById: actorId,
        establishedByName: actorName,
        metadata,
      });

      res.status(201).json({
        success: true,
        data: relationship,
        message: 'Relationship created successfully',
      });
    });
  };

  /**
   * Get relationship by ID
   * GET /api/relationships/:id
   */
  getRelationship = async (req: Request, res: Response) => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userReq = req as UserContextRequest;
      const tenantOrgId = userReq.tenantContext?.organizationId;

      const relationship = await this.relationshipService.getRelationshipById(id);

      if (!relationship) {
        throw new NotFoundError('Relationship');
      }

      // Verify the relationship belongs to the user's organization
      if (tenantOrgId && relationship.organizationId !== tenantOrgId) {
        throw new ForbiddenError('Access denied to this relationship');
      }

      res.json({
        success: true,
        data: relationship,
      });
    });
  };

  /**
   * Get all relationships for an organization
   * GET /api/organizations/:orgId/relationships
   */
  getOrganizationRelationships = async (req: Request, res: Response) => {
    await this.execute(req, res, async () => {
      const { orgId } = req.params;
      const userReq = req as UserContextRequest;
      const tenantOrgId = userReq.tenantContext?.organizationId;

      // Verify the requested org matches the user's tenant context
      if (tenantOrgId && orgId !== tenantOrgId) {
        throw new ForbiddenError("Access denied to this organization's relationships");
      }

      const { type, status, minTrust, maxTrust } = req.query;

      const filters: Record<string, unknown> = {};

      if (type) {
        filters.type = Array.isArray(type) ? type : [type];
      }

      if (status) {
        filters.status = Array.isArray(status) ? status : [status];
      }

      if (minTrust) {
        filters.minTrust = Number.parseFloat(minTrust as string);
      }

      if (maxTrust) {
        filters.maxTrust = Number.parseFloat(maxTrust as string);
      }

      const enriched = await this.relationshipService.getOrganizationRelationshipsEnriched(
        orgId,
        filters
      );

      res.json({
        success: true,
        data: enriched,
        count: enriched.length,
      });
    });
  };

  /**
   * Update a relationship
   * PUT /api/relationships/:id
   */
  updateRelationship = async (req: Request, res: Response) => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userReq = req as UserContextRequest;
      const tenantOrgId = userReq.tenantContext?.organizationId;
      const actorId = userReq.user?.id;
      const actorName = userReq.user?.username;

      // Verify relationship belongs to user's org before mutating
      if (tenantOrgId) {
        const existing = await this.relationshipService.getRelationshipById(id);
        if (!existing) {
          throw new NotFoundError('Relationship');
        }
        if (existing.organizationId !== tenantOrgId) {
          throw new ForbiddenError('Access denied to this relationship');
        }
      }

      const relationship = await this.relationshipService.updateRelationship(
        id,
        req.body,
        actorId,
        actorName
      );

      res.json({
        success: true,
        data: relationship,
        message: 'Relationship updated successfully',
      });
    });
  };

  /**
   * Get relationship history
   * GET /api/relationships/:id/history
   */
  getRelationshipHistory = async (req: Request, res: Response) => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { changeType, startDate, endDate, limit, offset } = req.query;

      const params: Record<string, unknown> = {};

      if (changeType) {
        params.changeType = Array.isArray(changeType) ? changeType : [changeType];
      }

      if (startDate) {
        params.startDate = new Date(startDate as string);
      }

      if (endDate) {
        params.endDate = new Date(endDate as string);
      }

      if (limit) {
        params.limit = Math.min(Number.parseInt(limit as string), 200);
      }

      if (offset) {
        params.offset = Number.parseInt(offset as string);
      }

      const history = await this.relationshipService.getRelationshipHistory(id, params);

      // Transform to detailed summaries
      const detailedHistory = history.map((entry: { getDetailedSummary: () => unknown }) =>
        entry.getDetailedSummary()
      );

      res.json({
        success: true,
        data: detailedHistory,
        count: detailedHistory.length,
      });
    });
  }; /**
   * Get relationship timeline with key milestones
   * GET /api/relationships/:id/timeline
   */
  getRelationshipTimeline = async (req: Request, res: Response) => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userReq = req as UserContextRequest;
      const tenantOrgId = userReq.tenantContext?.organizationId;

      const existing = await this.relationshipService.getRelationshipById(id, tenantOrgId);
      if (!existing) {
        throw new NotFoundError('Relationship');
      }

      const timeline = await this.relationshipService.getRelationshipTimeline(id);

      res.json({
        success: true,
        data: timeline,
      });
    });
  };

  /**
   * Get relationship analytics and metrics
   * GET /api/relationships/:id/analytics
   */
  getRelationshipAnalytics = async (req: Request, res: Response) => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { days } = req.query;
      const userReq = req as UserContextRequest;
      const tenantOrgId = userReq.tenantContext?.organizationId;

      const existing = await this.relationshipService.getRelationshipById(id, tenantOrgId);
      if (!existing) {
        throw new NotFoundError('Relationship');
      }

      const analyticsDays = days ? Number.parseInt(days as string) : 30;

      const analytics = await this.relationshipService.analyzeRelationshipHistory(
        id,
        analyticsDays
      );

      res.json({
        success: true,
        data: analytics,
      });
    });
  };

  /**
   * Get sentiment trend over time
   * GET /api/relationships/:id/sentiment-trend
   */
  getSentimentTrend = async (req: Request, res: Response) => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { days, interval } = req.query;

      const trendDays = days ? Number.parseInt(days as string) : 90;
      const trendInterval = (interval as 'day' | 'week' | 'month') || 'day';

      const trend = await this.relationshipService.getSentimentTrend(id, trendDays, trendInterval);

      res.json({
        success: true,
        data: trend,
      });
    });
  };

  /**
   * Record an interaction
   * POST /api/relationships/:id/interactions
   */
  recordInteraction = async (req: Request, res: Response) => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { description, sentiment } = req.body;
      const userReq = req as UserContextRequest;
      const tenantOrgId = userReq.tenantContext?.organizationId;
      const actorId = userReq.user?.id;
      const actorName = userReq.user?.username;

      // Verify relationship belongs to user's org before mutating
      if (tenantOrgId) {
        const existing = await this.relationshipService.getRelationshipById(id);
        if (!existing) {
          throw new NotFoundError('Relationship');
        }
        if (existing.organizationId !== tenantOrgId) {
          throw new ForbiddenError('Access denied to this relationship');
        }
      }

      const relationship = await this.relationshipService.recordInteraction({
        relationshipId: id,
        description,
        sentiment,
        actorId,
        actorName,
      });

      res.status(201).json({
        success: true,
        data: relationship,
        message: 'Interaction recorded successfully',
      });
    });
  };

  /**
   * Update trust score manually
   * POST /api/relationships/:id/trust
   */
  updateTrustScore = async (req: Request, res: Response) => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { delta, reason, metadata } = req.body;

      const userReq = req as UserContextRequest;
      const tenantOrgId = userReq.tenantContext?.organizationId;
      const actorId = userReq.user?.id;
      const actorName = userReq.user?.username;

      const relationship = await this.relationshipService.getRelationshipById(id);
      if (!relationship) {
        throw new NotFoundError('Relationship');
      }

      // Verify relationship belongs to user's org before mutating
      if (tenantOrgId && relationship.organizationId !== tenantOrgId) {
        throw new ForbiddenError('Access denied to this relationship');
      }

      const newTrust = await this.relationshipService.updateTrustScore(
        relationship,
        { reason, delta, metadata },
        actorId,
        actorName
      );

      res.json({
        success: true,
        data: {
          relationshipId: id,
          trustScore: newTrust,
          change: delta,
        },
        message: 'Trust score updated successfully',
      });
    });
  };

  /**
   * Get trust score history
   * GET /api/relationships/:id/trust-history
   */
  getTrustHistory = async (req: Request, res: Response) => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { days } = req.query;
      const userReq = req as UserContextRequest;
      const tenantOrgId = userReq.tenantContext?.organizationId;

      const existing = await this.relationshipService.getRelationshipById(id, tenantOrgId);
      if (!existing) {
        throw new NotFoundError('Relationship');
      }

      const historyDays = days ? Number.parseInt(days as string) : 90;
      const trustTrend = await this.relationshipService.getTrustTrend(id, historyDays);

      res.json({
        success: true,
        data: trustTrend,
      });
    });
  };

  /**
   * Get trust recommendations
   * GET /api/relationships/:id/trust/recommendations
   */
  getTrustRecommendations = async (req: Request, res: Response) => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userReq = req as UserContextRequest;
      const tenantOrgId = userReq.tenantContext?.organizationId;

      const relationship = await this.relationshipService.getRelationshipById(id, tenantOrgId);
      if (!relationship) {
        throw new NotFoundError('Relationship');
      }

      const recommendations = this.relationshipService.getTrustRecommendations(relationship);

      res.json({
        success: true,
        data: recommendations,
      });
    });
  };

  /**
   * Get relationship health summary
   * GET /api/organizations/:orgId/relationships/health
   */
  getRelationshipHealthSummary = async (req: Request, res: Response) => {
    await this.execute(req, res, async () => {
      const { orgId } = req.params;
      const userReq = req as UserContextRequest;
      const tenantOrgId = userReq.tenantContext?.organizationId;

      // Verify the requested org matches the user's tenant context
      if (tenantOrgId && orgId !== tenantOrgId) {
        throw new ForbiddenError("Access denied to this organization's relationships");
      }

      const summary = await this.relationshipService.getRelationshipHealthSummary(orgId);

      res.json({
        success: true,
        data: summary,
      });
    });
  };

  /**
   * Get relationships that need review
   * GET /api/organizations/:orgId/relationships/review-needed
   */
  getRelationshipsNeedingReview = async (req: Request, res: Response) => {
    await this.execute(req, res, async () => {
      const { orgId } = req.params;
      const userReq = req as UserContextRequest;
      const tenantOrgId = userReq.tenantContext?.organizationId;

      // Verify the requested org matches the user's tenant context
      if (tenantOrgId && orgId !== tenantOrgId) {
        throw new ForbiddenError("Access denied to this organization's relationships");
      }

      const relationships = await this.relationshipService.getRelationshipsNeedingReview(orgId);

      res.json({
        success: true,
        data: relationships,
        count: relationships.length,
      });
    });
  };

  /**
   * Establish mutual relationship
   * POST /api/relationships/:id/establish-mutual
   */
  establishMutualRelationship = async (req: Request, res: Response) => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const userReq = req as UserContextRequest;
      const tenantOrgId = userReq.tenantContext?.organizationId;
      const actorId = userReq.user?.id;
      const actorName = userReq.user?.username;

      // Verify relationship belongs to user's org before mutating
      if (tenantOrgId) {
        const existing = await this.relationshipService.getRelationshipById(id);
        if (!existing) {
          throw new NotFoundError('Relationship');
        }
        if (existing.organizationId !== tenantOrgId) {
          throw new ForbiddenError('Access denied to this relationship');
        }
      }

      await this.relationshipService.establishMutualRelationship(id, actorId, actorName);

      res.json({
        success: true,
        message: 'Mutual relationship established successfully',
      });
    });
  };

  /**
   * Terminate a relationship
   * POST /api/relationships/:id/terminate
   */
  terminateRelationship = async (req: Request, res: Response) => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      const { reason } = req.body;
      const userReq = req as UserContextRequest;
      const tenantOrgId = userReq.tenantContext?.organizationId;
      const actorId = userReq.user?.id;
      const actorName = userReq.user?.username;

      // Verify relationship belongs to user's org before mutating
      if (tenantOrgId) {
        const existing = await this.relationshipService.getRelationshipById(id);
        if (!existing) {
          throw new NotFoundError('Relationship');
        }
        if (existing.organizationId !== tenantOrgId) {
          throw new ForbiddenError('Access denied to this relationship');
        }
      }

      await this.relationshipService.terminateRelationship(id, reason, actorId, actorName);

      res.json({
        success: true,
        message: 'Relationship terminated successfully',
      });
    });
  };

  /**
   * Get all relationship types (enum)
   * GET /api/relationships/types
   */
  getRelationshipTypes = async (req: Request, res: Response) => {
    await this.execute(req, res, async () => {
      res.json({
        success: true,
        data: Object.values(RelationshipType),
      });
    });
  };

  /**
   * Get all change types (enum)
   * GET /api/relationships/change-types
   */
  getChangeTypes = async (req: Request, res: Response) => {
    await this.execute(req, res, async () => {
      res.json({
        success: true,
        data: Object.values(ChangeType),
      });
    });
  };

  /**
   * Get all interaction sentiments (enum)
   * GET /api/relationships/sentiments
   */
  getInteractionSentiments = async (req: Request, res: Response) => {
    await this.execute(req, res, async () => {
      res.json({
        success: true,
        data: Object.values(InteractionSentiment),
      });
    });
  };
}
