import { Request, Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { WikiService } from '../services/content/WikiService';

import { BaseController } from './BaseController';

/**
 * Controller for wiki page CRUD, tree, revision, and search operations.
 * Extends BaseController for standardized error handling and tenant context.
 */
export class WikiController extends BaseController {
  private wikiService: WikiService;

  constructor() {
    super();
    this.wikiService = new WikiService();
  }

  // ──── CRUD ────────────────────────────────────────────────────

  public createPage = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const authReq = req as AuthRequest;
      const organizationId = this.getOrganizationId(authReq);
      const userId = authReq.user?.id;

      const page = await this.wikiService.createPage(organizationId, userId!, req.body);
      res.status(201).json(page);
    });
  };

  public getPage = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      return this.wikiService.getPage(organizationId, req.params.pageId);
    });
  };

  public getAllPages = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      return this.wikiService.getAllPages(organizationId);
    });
  };

  public updatePage = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const authReq = req as AuthRequest;
      const organizationId = this.getOrganizationId(authReq);
      const userId = authReq.user?.id;

      return this.wikiService.updatePage(organizationId, req.params.pageId, userId!, req.body);
    });
  };

  public deletePage = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const authReq = req as AuthRequest;
      const organizationId = this.getOrganizationId(authReq);
      const userId = authReq.user?.id;

      await this.wikiService.deletePage(organizationId, req.params.pageId, userId!);
      res.status(204).send();
    });
  };

  // ──── Tree ────────────────────────────────────────────────────

  public getPageTree = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      return this.wikiService.getPageTree(organizationId);
    });
  };

  public movePage = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      await this.wikiService.movePage(organizationId, req.params.pageId, req.body);
      res.status(200).json({ success: true });
    });
  };

  // ──── Revisions ───────────────────────────────────────────────

  public getRevisions = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      return this.wikiService.getRevisions(organizationId, req.params.pageId);
    });
  };

  public getRevision = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      return this.wikiService.getRevision(organizationId, req.params.pageId, req.params.revisionId);
    });
  };

  public restoreRevision = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const authReq = req as AuthRequest;
      const organizationId = this.getOrganizationId(authReq);
      const userId = authReq.user?.id;

      return this.wikiService.restoreRevision(
        organizationId,
        req.params.pageId,
        req.body.revisionId,
        userId!
      );
    });
  };

  // ──── Search ──────────────────────────────────────────────────

  public searchPages = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req as AuthRequest);
      const q = req.query.q as string;
      const limit = Math.min(req.query.limit ? parseInt(req.query.limit as string, 10) : 20, 200);

      return this.wikiService.searchPages(organizationId, q, limit);
    });
  };
}
