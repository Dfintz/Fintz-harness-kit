import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { IntelAuditAction } from '../models/IntelAuditLog';
import { IntelCategory, IntelClassification } from '../models/IntelEntry';
import { AppointOfficerInput, IntelOfficerService } from '../services/intel/IntelOfficerService';
import { CreateIntelEntryInput, IntelVaultService } from '../services/intel/IntelVaultService';
import { sanitizeObject } from '../utils/prototypePollutionPrevention';

import { BaseController } from './BaseController';

/**
 * Controller for Intel vault operations
 */
export class IntelVaultController extends BaseController {
  private intelVaultService: IntelVaultService;
  private intelOfficerService: IntelOfficerService;

  constructor() {
    super();
    this.intelVaultService = new IntelVaultService();
    this.intelOfficerService = new IntelOfficerService();
  }

  /**
   * Check user's Intel vault access
   * GET /api/organizations/:orgId/intel/access
   */
  public checkAccess = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      const { orgId } = req.params;

      return this.intelVaultService.checkAccess(user.id, orgId);
    });
  };

  /**
   * Create Intel entry
   * POST /api/organizations/:orgId/intel/entries
   */
  public createEntry = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      const { orgId } = req.params;
      const ipAddress = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.get('user-agent');

      // Sanitize request body to prevent prototype pollution (CWE-1321)
      const safeBody = sanitizeObject(req.body, [
        'title',
        'content',
        'category',
        'classification',
        'tags',
        'relatedEntities',
        'expiresAt',
        'isArchived',
      ]);

      const entry = await this.intelVaultService.createEntry(
        {
          ...safeBody,
          organizationId: orgId,
        } as CreateIntelEntryInput,
        user.id,
        ipAddress,
        userAgent
      );

      res.status(201);
      return entry;
    });
  };

  /**
   * Get Intel entries
   * GET /api/organizations/:orgId/intel/entries
   */
  public getEntries = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      const { orgId } = req.params;
      const { includeArchived, classification, category, search, limit, offset } = req.query;

      return this.intelVaultService.getEntries(orgId, user.id, {
        includeArchived: includeArchived === 'true',
        classification: classification as IntelClassification,
        category: category as IntelCategory,
        search: search as string,
        limit: limit ? Math.min(parseInt(limit as string), 200) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
    });
  };

  /**
   * Get single Intel entry
   * GET /api/organizations/:orgId/intel/entries/:entryId
   */
  public getEntry = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      const { orgId, entryId } = req.params;
      const ipAddress = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.get('user-agent');

      return this.intelVaultService.getEntry(entryId, user.id, orgId, ipAddress, userAgent);
    });
  };

  /**
   * Update Intel entry
   * PATCH /api/organizations/:orgId/intel/entries/:entryId
   */
  public updateEntry = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      const { orgId, entryId } = req.params;
      const ipAddress = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.get('user-agent');

      const safeBody = sanitizeObject(req.body, [
        'title',
        'content',
        'classification',
        'tags',
        'metadata',
      ]);
      return this.intelVaultService.updateEntry(
        entryId,
        user.id,
        orgId,
        safeBody,
        ipAddress,
        userAgent
      );
    });
  };

  /**
   * Delete Intel entry
   * DELETE /api/organizations/:orgId/intel/entries/:entryId
   */
  public deleteEntry = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { orgId, entryId } = req.params;
      const ipAddress = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.get('user-agent');

      await this.intelVaultService.deleteEntry(entryId, user.id, orgId, ipAddress, userAgent);

      res.status(204).send();
    });
  };

  /**
   * Get audit logs
   * GET /api/organizations/:orgId/intel/audit-logs
   */
  public getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      const { orgId } = req.params;
      const { intelEntryId, action, userId, startDate, endDate, limit, offset } = req.query;

      return this.intelVaultService.getAuditLogs(orgId, user.id, {
        intelEntryId: intelEntryId as string,
        action: action as IntelAuditAction,
        userId: userId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? Math.min(parseInt(limit as string), 200) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
    });
  };

  // ==================== INTEL OFFICER MANAGEMENT ====================

  /**
   * Appoint Intel officer
   * POST /api/organizations/:orgId/intel/officers
   */
  public appointOfficer = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      const { orgId } = req.params;
      const ipAddress = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.get('user-agent');

      // Sanitize request body to prevent prototype pollution (CWE-1321)
      const safeBody = sanitizeObject(req.body, [
        'userId',
        'rank',
        'clearanceLevel',
        'specializations',
        'notes',
        'appointedAt',
      ]);

      const officer = await this.intelOfficerService.appointOfficer(
        {
          ...safeBody,
          organizationId: orgId,
        } as AppointOfficerInput,
        user.id,
        ipAddress,
        userAgent
      );

      res.status(201);
      return officer;
    });
  };

  /**
   * Get Intel officers
   * GET /api/organizations/:orgId/intel/officers
   */
  public getOfficers = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      const { orgId } = req.params;
      const { includeInactive, rank } = req.query;

      return this.intelOfficerService.getOfficers(orgId, user.id, {
        includeInactive: includeInactive === 'true',
        rank,
      } as Record<string, unknown>);
    });
  };

  /**
   * Get single Intel officer
   * GET /api/organizations/:orgId/intel/officers/:officerId
   */
  public getOfficer = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      const { orgId, officerId } = req.params;

      return this.intelOfficerService.getOfficer(officerId, user.id, orgId);
    });
  };

  /**
   * Update Intel officer
   * PATCH /api/organizations/:orgId/intel/officers/:officerId
   */
  public updateOfficer = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      const { orgId, officerId } = req.params;
      const ipAddress = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.get('user-agent');

      const safeBody = sanitizeObject(req.body, ['role', 'permissions', 'status']);
      return this.intelOfficerService.updateOfficer(
        officerId,
        user.id,
        orgId,
        safeBody,
        ipAddress,
        userAgent
      );
    });
  };

  /**
   * Remove Intel officer
   * DELETE /api/organizations/:orgId/intel/officers/:officerId
   */
  public removeOfficer = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { orgId, officerId } = req.params;
      const { reason } = req.body;
      const ipAddress = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.get('user-agent');

      await this.intelOfficerService.removeOfficer(
        officerId,
        user.id,
        orgId,
        reason,
        ipAddress,
        userAgent
      );

      res.status(204).send();
    });
  };
}
