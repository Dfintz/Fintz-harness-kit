import { Request, Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { MissionStatus } from '../models/Mission';
import { AIBriefingGenerationService } from '../services/content/AIBriefingGenerationService';
import {
  type ImportScmdbMissionInput,
  type ScmdbMissionCardFilters,
  MissionFilters,
  MissionService,
  MissionWorkflowPhase,
} from '../services/content/MissionService';
import { NotFoundError, ValidationError } from '../utils/apiErrors';
import { logger } from '../utils/logger';
import { extractPaginationOptions } from '../utils/pagination';
import { sanitizeObject } from '../utils/prototypePollutionPrevention';

import { BaseController } from './BaseController';

/**
 * Controller for mission CRUD and lifecycle operations.
 * Uses standard v2 response helpers (res.success / res.paginated) for consistent API envelope.
 */
export class MissionController extends BaseController {
  private readonly missionService: MissionService;
  private aiService?: AIBriefingGenerationService;

  constructor() {
    super();
    this.missionService = new MissionService();
  }

  private getAIService(): AIBriefingGenerationService {
    this.aiService ??= new AIBriefingGenerationService();
    return this.aiService;
  }

  // ---- CRUD ----

  public createMission = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthRequest;
      const organizationId = this.getOrganizationId(authReq);

      const missionData = {
        ...sanitizeObject(req.body as Record<string, unknown>, [
          'title',
          'description',
          'missionType',
          'difficulty',
          'priority',
          'fleetId',
          'location',
          'objectives',
          'tags',
          'reward',
          'startDate',
          'endDate',
          'notes',
        ]),
        createdBy: authReq.user?.id,
      };

      const mission = await this.missionService.createMission(organizationId, missionData);
      res.status(201).success(mission);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public getMission = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const mission = await this.missionService.getMissionById(
        req.params.missionId,
        organizationId
      );
      if (!mission) {
        throw new NotFoundError('Mission');
      }
      res.success(mission);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public getAllMissions = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const paginationOptions = extractPaginationOptions(req);

      // Normalize tags: accept string or string[]
      let tags: string[] | undefined;
      if (req.query.tags) {
        tags = Array.isArray(req.query.tags)
          ? (req.query.tags as string[])
          : (req.query.tags as string).split(',');
      }

      const filters: MissionFilters = {
        status: req.query.status as MissionStatus | undefined,
        missionType: req.query.missionType as MissionFilters['missionType'],
        difficulty: req.query.difficulty as MissionFilters['difficulty'],
        priority: req.query.priority as MissionFilters['priority'],
        createdBy: req.query.createdBy as string | undefined,
        assignedTo: req.query.assignedTo as string | undefined,
        fleetId: req.query.fleetId as string | undefined,
        tags,
        search: req.query.search as string | undefined,
        startDateFrom: req.query.startDateFrom
          ? new Date(req.query.startDateFrom as string)
          : undefined,
        startDateTo: req.query.startDateTo ? new Date(req.query.startDateTo as string) : undefined,
      };

      const result = await this.missionService.getAllMissions(
        organizationId,
        paginationOptions,
        filters
      );

      const { pagination } = result;
      const limit = pagination.limit;
      const page = pagination.page;

      res.paginated(result.data, {
        total: pagination.total,
        limit,
        offset: (page - 1) * limit,
        hasMore: pagination.hasNext,
        page,
        totalPages: pagination.totalPages,
        hasNext: pagination.hasNext,
        hasPrevious: pagination.hasPrev,
      });
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public updateMission = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const mission = await this.missionService.updateMission(
        req.params.missionId,
        organizationId,
        req.body
      );
      if (!mission) {
        throw new NotFoundError('Mission');
      }
      res.success(mission);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public deleteMission = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthRequest;
      const organizationId = this.getOrganizationId(authReq);
      const success = await this.missionService.deleteMission(
        req.params.missionId,
        organizationId,
        authReq.user?.id || 'unknown'
      );
      if (!success) {
        throw new NotFoundError('Mission');
      }
      res.status(204).send();
    } catch (error) {
      this.handleError(res, error);
    }
  };

  // ---- Status & Lifecycle ----

  public getWorkflow = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const workflow = await this.missionService.getWorkflow(req.params.missionId, organizationId);
      if (!workflow) {
        throw new NotFoundError('Mission');
      }
      res.success(workflow);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public advanceWorkflowPhase = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const { phase, notes } = req.body as {
        phase: MissionWorkflowPhase;
        notes?: string;
      };
      const mission = await this.missionService.advanceWorkflowPhase(
        req.params.missionId,
        organizationId,
        phase,
        notes
      );
      if (!mission) {
        throw new NotFoundError('Mission');
      }
      res.success(mission);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public updateStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const { status } = req.body;
      const mission = await this.missionService.transitionStatus(
        req.params.missionId,
        organizationId,
        status
      );
      if (!mission) {
        throw new NotFoundError('Mission');
      }
      res.success(mission);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public completeMission = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const { status, notes } = req.body;

      if (status !== MissionStatus.COMPLETED && status !== MissionStatus.FAILED) {
        throw new ValidationError('Complete endpoint only accepts completed or failed status');
      }

      const mission = await this.missionService.completeMission(
        req.params.missionId,
        organizationId,
        { status, notes }
      );
      if (!mission) {
        throw new NotFoundError('Mission');
      }
      res.success(mission);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  // ---- Assignment & Participants ----

  public assignMission = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const { userId, role } = req.body;
      const mission = await this.missionService.assignMission(
        req.params.missionId,
        organizationId,
        userId,
        role
      );
      if (!mission) {
        throw new NotFoundError('Mission');
      }
      res.success(mission);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public getParticipants = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const participants = await this.missionService.getParticipants(
        req.params.missionId,
        organizationId
      );
      if (participants === null) {
        throw new NotFoundError('Mission');
      }
      res.success(participants);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public addParticipant = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const { userId, role } = req.body;
      const mission = await this.missionService.addParticipant(
        req.params.missionId,
        organizationId,
        userId,
        role
      );
      if (!mission) {
        throw new NotFoundError('Mission');
      }
      res.success(mission);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public removeParticipant = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const mission = await this.missionService.removeParticipant(
        req.params.missionId,
        organizationId,
        req.params.userId
      );
      if (!mission) {
        throw new NotFoundError('Mission');
      }
      res.success(mission);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public generateBriefing = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthRequest;
      const organizationId = authReq.user?.currentOrganizationId;
      const userId = authReq.user?.id;

      if (!organizationId || !userId) {
        res.status(400).json({ error: 'Organization and user context required' });
        return;
      }

      const mission = await this.missionService.getMissionById(
        req.params.missionId,
        organizationId
      );
      if (!mission) {
        res.status(404).json({ error: 'Mission not found' });
        return;
      }

      const generationRequest = {
        missionType: req.body.missionType || mission.missionType,
        objectives: req.body.objectives || mission.objectives || [],
        difficulty: req.body.difficulty || mission.difficulty,
        location: req.body.location || mission.location,
        fleetComposition: req.body.fleetComposition || undefined,
        participantCount: req.body.participantCount || mission.participants?.length || undefined,
        estimatedDuration: req.body.estimatedDuration || undefined,
        additionalContext: req.body.additionalContext || undefined,
      };

      const result = await this.getAIService().generateBriefing(
        organizationId,
        userId,
        generationRequest
      );
      res.json(result);
    } catch (error) {
      const status = (error as Error & { status?: number }).status || 500;
      logger.error('AI briefing generation failed', {
        missionId: req.params.missionId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(status).json({ error: (error as Error).message || 'AI generation failed' });
    }
  };

  public generateBriefingStream = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthRequest;
      const organizationId = authReq.user?.currentOrganizationId;
      const userId = authReq.user?.id;

      if (!organizationId || !userId) {
        res.status(400).json({ error: 'Organization and user context required' });
        return;
      }

      const mission = await this.missionService.getMissionById(
        req.params.missionId,
        organizationId
      );
      if (!mission) {
        res.status(404).json({ error: 'Mission not found' });
        return;
      }

      const generationRequest = {
        missionType: req.body.missionType || mission.missionType,
        objectives: req.body.objectives || mission.objectives || [],
        difficulty: req.body.difficulty || mission.difficulty,
        location: req.body.location || mission.location,
        fleetComposition: req.body.fleetComposition || undefined,
        participantCount: req.body.participantCount || mission.participants?.length || undefined,
        estimatedDuration: req.body.estimatedDuration || undefined,
        additionalContext: req.body.additionalContext || undefined,
      };

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      const result = await this.getAIService().generateBriefingStream(
        organizationId,
        userId,
        generationRequest,
        (chunk: string) => {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
      );

      res.write(`data: ${JSON.stringify({ done: true, ...result })}\n\n`);
      res.end();
    } catch (error) {
      const status = (error as Error & { status?: number }).status || 500;
      logger.error('AI briefing streaming generation failed', {
        missionId: req.params.missionId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`);
        res.end();
      } else {
        res.status(status).json({ error: (error as Error).message || 'AI streaming failed' });
      }
    }
  };

  // ---- Objectives ----

  public addObjective = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const mission = await this.missionService.addObjective(
        req.params.missionId,
        organizationId,
        req.body
      );
      if (!mission) {
        throw new NotFoundError('Mission');
      }
      res.success(mission);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public updateObjective = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const mission = await this.missionService.updateObjective(
        req.params.missionId,
        organizationId,
        req.params.objectiveId,
        req.body
      );
      if (!mission) {
        throw new NotFoundError('Mission or objective');
      }
      res.success(mission);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public removeObjective = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const mission = await this.missionService.removeObjective(
        req.params.missionId,
        organizationId,
        req.params.objectiveId
      );
      if (!mission) {
        throw new NotFoundError('Mission or objective');
      }
      res.success(mission);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  // ---- Templates ----

  public getTemplates = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const templates = await this.missionService.getTemplates(organizationId);
      res.success(templates);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  // ---- Fleet Missions ----

  public getMissionsByFleet = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const missions = await this.missionService.getMissionsByFleet(
        req.params.fleetId,
        organizationId
      );
      res.success(missions);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  // ---- Active Missions ----

  public getActiveMissions = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const missions = await this.missionService.getActiveMissions(organizationId);
      res.success(missions);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public searchScmdbMissionCards = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters: ScmdbMissionCardFilters = {
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        category: typeof req.query.category === 'string' ? req.query.category : undefined,
        limit:
          typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined,
      };

      const cards = await this.missionService.searchScmdbMissionCards(filters);
      res.success(cards);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  public importScmdbMissions = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const userId = this.getAuthUser(req as AuthRequest).id;
      const items = Array.isArray(req.body.items)
        ? (req.body.items as ImportScmdbMissionInput[])
        : [];

      const result = await this.missionService.importScmdbMissions(organizationId, userId, items);
      res.status(201).success(result);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  /**
   * Get available SCMDB filter options (categories and counts).
   * Requires authentication (route is auth-protected for audit logging purposes).
   * Returns global catalog data that is identical for all authenticated organizations.
   * ExternalCatalogRecord has no organizationId — the SCMDB catalog is intentionally shared.
   */
  public getScmdbFilters = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters = await this.missionService.getScmdbAvailableFilters();
      res.success(filters);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  /**
   * Import a single SCMDB mission by URL or mission ID.
   * Supports direct URL import (paste link) in addition to browse-and-select.
   */
  public importScmdbByUrl = async (req: Request, res: Response): Promise<void> => {
    try {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const userId = this.getAuthUser(req as AuthRequest).id;
      const url = typeof req.body.url === 'string' ? req.body.url.trim() : '';
      const priority = typeof req.body.priority === 'string' ? req.body.priority : undefined;
      const notes = typeof req.body.notes === 'string' ? req.body.notes : undefined;
      const startDate = req.body.startDate ? new Date(req.body.startDate) : undefined;
      const endDate = req.body.endDate ? new Date(req.body.endDate) : undefined;

      const mission = await this.missionService.importScmdbMissionByUrl(
        organizationId,
        userId,
        url,
        { priority, notes, startDate, endDate }
      );

      res.status(201).success({ mission });
    } catch (error) {
      this.handleError(res, error);
    }
  };
}
