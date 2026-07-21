import { Request, Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { BriefingClassification, BriefingStatus } from '../models/Briefing';
import { BriefingService } from '../services/content';
import { BriefingDiscordWebhookService } from '../services/discord/BriefingDiscordWebhookService';
import { NotFoundError } from '../utils/apiErrors';
import { extractPaginationOptions } from '../utils/pagination';
import { sanitizeObject } from '../utils/prototypePollutionPrevention';

import { BaseController } from './BaseController';

/**
 * Controller for briefing operations
 * Extends BaseController for standardized error handling
 */
export class BriefingController extends BaseController {
  private readonly briefingService: BriefingService;
  private readonly briefingDiscordService: BriefingDiscordWebhookService;

  constructor() {
    super();
    this.briefingService = new BriefingService();
    this.briefingDiscordService = new BriefingDiscordWebhookService();
  }

  public createBriefing = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const authReq = req as AuthRequest;
      const organizationId = this.getOrganizationId(authReq);
      const userId = this.getAuthUser(authReq).id;
      const briefing = await this.briefingService.createBriefing(organizationId, {
        ...sanitizeObject(req.body as Record<string, unknown>, [
          'title',
          'missionId',
          'type',
          'classification',
          'operationIds',
          'summary',
          'content',
          'objectives',
          'targetDate',
          'expiresAt',
          'tags',
          'notes',
        ]),
        creatorId: userId,
      });
      res.status(201).json(briefing);
    });
  };

  public getBriefing = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const briefing = await this.briefingService.getBriefingById(req.params.id, organizationId);
      if (!briefing) {
        throw new NotFoundError('Briefing');
      }
      return briefing;
    });
  };

  public postToDiscord = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const authReq = req as AuthRequest;
      const organizationId = this.getOrganizationId(authReq);
      const userId = this.getAuthUser(authReq).id;
      const briefing = await this.briefingService.getBriefingById(req.params.id, organizationId);
      if (!briefing) {
        throw new NotFoundError('Briefing');
      }
      const { webhookUrl } = req.body as { webhookUrl: string };
      // deepcode ignore Ssrf: webhookUrl is validated inside postBriefingToWebhook() via
      // parseDiscordWebhookUrl() — https + Discord-owned host allowlist + /api/webhooks/ path,
      // and the request runs with maxRedirects:0.
      // NOSONAR: CWE-918 false positive — destination host is allowlist-validated downstream.
      await this.briefingDiscordService.postBriefingToWebhook(briefing, webhookUrl, {
        organizationId,
        userId,
      }); // NOSONAR
      return { posted: true };
    });
  };

  public getAllBriefings = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const paginationOptions = extractPaginationOptions(req);
      const filters = {
        creatorId: req.query.creatorId as string | undefined,
        missionId: req.query.missionId as string | undefined,
        status: req.query.status as BriefingStatus | undefined,
        classification: req.query.classification as BriefingClassification | undefined,
        operationId: req.query.operationId as string | undefined,
        tags: typeof req.query.tags === 'string' ? req.query.tags.split(',') : undefined,
      };
      return this.briefingService.getAllBriefings(organizationId, paginationOptions, filters);
    });
  };

  public getBriefingsByMission = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      return this.briefingService.getBriefingsByMission(req.params.missionId, organizationId);
    });
  };

  public updateBriefing = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const briefing = await this.briefingService.updateBriefing(
        req.params.id,
        organizationId,
        sanitizeObject(req.body as Record<string, unknown>, [
          'title',
          'classification',
          'operationIds',
          'elements',
          'backgroundImage',
          'pages',
          'tags',
          'status',
          'participants',
        ])
      );
      if (!briefing) {
        throw new NotFoundError('Briefing');
      }
      return briefing;
    });
  };

  public deleteBriefing = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const success = await this.briefingService.deleteBriefing(req.params.id, organizationId);
      if (!success) {
        throw new NotFoundError('Briefing');
      }
      res.status(204).send();
    });
  };

  public addElement = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const briefing = await this.briefingService.addElement(
        req.params.id,
        organizationId,
        req.body
      );
      if (!briefing) {
        throw new NotFoundError('Briefing');
      }
      return briefing;
    });
  };

  public updateElement = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const briefing = await this.briefingService.updateElement(
        req.params.id,
        organizationId,
        req.params.elementId,
        req.body
      );
      if (!briefing) {
        throw new NotFoundError('Briefing or element');
      }
      return briefing;
    });
  };

  public deleteElement = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const briefing = await this.briefingService.deleteElement(
        req.params.id,
        organizationId,
        req.params.elementId
      );
      if (!briefing) {
        throw new NotFoundError('Briefing or element');
      }
      return briefing;
    });
  };

  public addParticipant = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const { userId } = req.body;
      const briefing = await this.briefingService.addParticipant(
        req.params.id,
        organizationId,
        userId
      );
      if (!briefing) {
        throw new NotFoundError('Briefing');
      }
      return briefing;
    });
  };

  public removeParticipant = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const { userId } = req.body;
      const briefing = await this.briefingService.removeParticipant(
        req.params.id,
        organizationId,
        userId
      );
      if (!briefing) {
        throw new NotFoundError('Briefing');
      }
      return briefing;
    });
  };

  public updateStatus = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const { status } = req.body;
      const briefing = await this.briefingService.updateStatus(
        req.params.id,
        organizationId,
        status
      );
      if (!briefing) {
        throw new NotFoundError('Briefing');
      }
      return briefing;
    });
  };

  public createVersion = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const briefing = await this.briefingService.createVersion(req.params.id, organizationId);
      if (!briefing) {
        throw new NotFoundError('Briefing');
      }
      res.status(201).json(briefing);
    });
  };
}
