import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import {
  BackupSearchFilters,
  BackupService,
  ConfigureScheduleDTO,
  CreateBackupDTO,
} from '../services/backup/BackupService';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/apiErrors';

import { BaseController } from './BaseController';

/**
 * Helper function to check if user is org admin
 */
function isUserOrgAdmin(user: AuthRequest['user']): boolean {
  return user?.role === 'admin' || user?.role === 'org_admin' || user?.role === 'superadmin';
}

/**
 * Helper function to parse pagination parameters
 */
function parsePagination(
  query: AuthRequest['query'],
  defaults?: { page: number; limit: number }
): { page: number; limit: number } {
  const MAX_LIMIT = 100;
  const defaultPage = defaults?.page ?? 1;
  const defaultLimit = defaults?.limit ?? 20;

  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const rawLimit = Array.isArray(query.limit) ? query.limit[0] : query.limit;

  const parsedPage = typeof rawPage === 'string' ? Number.parseInt(rawPage, 10) : Number.NaN;
  const parsedLimit = typeof rawLimit === 'string' ? Number.parseInt(rawLimit, 10) : Number.NaN;

  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : defaultPage;
  let limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : defaultLimit;
  if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }

  return { page, limit };
}

/**
 * Backup Controller
 *
 * Handles HTTP concerns for backup & restore operations.
 * All endpoints require admin-level permissions.
 */
export class BackupController extends BaseController {
  private readonly backupService: BackupService;

  constructor() {
    super();
    this.backupService = new BackupService();
  }

  // ==================== STATUS ====================

  getStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.tenantContext?.organizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      if (!isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Admin access required');
      }

      const status = await this.backupService.getBackupStatus(organizationId);
      res.success(status);
    });
  };

  // ==================== CREATE ====================

  createBackup = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.tenantContext?.organizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      if (!isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Admin access required');
      }

      const dto = req.body as CreateBackupDTO;
      const userId = req.user?.id ?? 'unknown';
      const userName = req.user?.username ?? 'Unknown User';

      const backup = await this.backupService.createBackup(organizationId, userId, userName, dto);

      res.status(201).json({ success: true, data: backup });
    });
  };

  // ==================== LIST ====================

  listBackups = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.tenantContext?.organizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      if (!isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Admin access required');
      }

      const { page, limit } = parsePagination(req.query);
      const filters: BackupSearchFilters = {};

      if (req.query.status) {
        filters.status = req.query.status as BackupSearchFilters['status'];
      }
      if (req.query.backupType) {
        filters.backupType = req.query.backupType as BackupSearchFilters['backupType'];
      }
      if (req.query.sortBy) {
        filters.sortBy = req.query.sortBy as string;
      }
      if (req.query.sortOrder) {
        filters.sortOrder = req.query.sortOrder as 'ASC' | 'DESC';
      }

      const result = await this.backupService.listBackups(organizationId, filters, { page, limit });

      res.success(result);
    });
  };

  // ==================== DOWNLOAD ====================

  downloadBackup = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.tenantContext?.organizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      if (!isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Admin access required');
      }

      const { backupId } = req.params;
      if (!backupId) {
        throw new ValidationError('Backup ID is required');
      }

      const url = await this.backupService.getDownloadUrl(organizationId, backupId);
      if (!url) {
        throw new NotFoundError('Backup not found or download unavailable');
      }

      res.success({ downloadUrl: url });
    });
  };

  // ==================== RESTORE ====================

  restoreBackup = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.tenantContext?.organizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      if (!isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Admin access required');
      }

      const { backupId } = req.params;
      if (!backupId) {
        throw new ValidationError('Backup ID is required');
      }

      const userId = req.user?.id ?? 'unknown';
      const userName = req.user?.username ?? 'Unknown User';

      const result = await this.backupService.restoreFromBackup(
        organizationId,
        backupId,
        userId,
        userName
      );

      res.success(result);
    });
  };

  // ==================== DELETE ====================

  deleteBackup = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.tenantContext?.organizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      if (!isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Admin access required');
      }

      const { backupId } = req.params;
      if (!backupId) {
        throw new ValidationError('Backup ID is required');
      }

      const userId = req.user?.id ?? 'unknown';
      const userName = req.user?.username ?? 'Unknown User';

      await this.backupService.deleteBackup(organizationId, backupId, userId, userName);

      res.success({ message: 'Backup deleted successfully' });
    });
  };

  // ==================== SCHEDULE ====================

  configureSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.tenantContext?.organizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      if (!isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Admin access required');
      }

      const dto = req.body as ConfigureScheduleDTO;
      const userId = req.user?.id ?? 'unknown';
      const userName = req.user?.username ?? 'Unknown User';

      const schedule = await this.backupService.configureSchedule(
        organizationId,
        userId,
        userName,
        dto
      );

      res.success(schedule);
    });
  };

  getSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.tenantContext?.organizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      if (!isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Admin access required');
      }

      const schedule = await this.backupService.getSchedule(organizationId);
      res.success(schedule);
    });
  };

  updateSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.tenantContext?.organizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      if (!isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('Admin access required');
      }

      const dto = req.body as ConfigureScheduleDTO;
      const userId = req.user?.id ?? 'unknown';
      const userName = req.user?.username ?? 'Unknown User';

      const schedule = await this.backupService.configureSchedule(
        organizationId,
        userId,
        userName,
        dto
      );

      res.success(schedule);
    });
  };
}
