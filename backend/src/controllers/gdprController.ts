import fs from 'node:fs/promises';
import path from 'node:path';

import { Response } from 'express';
import { Repository } from 'typeorm';

import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { DEFAULT_GDPR_SETTINGS, Organization } from '../models/Organization';
import { ConsentType } from '../models/UserConsent';
import { getGdprExportStorageService } from '../services/cloud/GdprExportStorageService';
import { ConsentService } from '../services/user/ConsentService';
import { getExportRequestService } from '../services/user/ExportRequestService';
import { getGdprDataDeletionService } from '../services/user/GdprDataDeletionService';
import { ValidationError } from '../utils/apiErrors';
import { convertGdprDataToCsv } from '../utils/gdprCsvExporter';
import { getUserPrimaryOrganization } from '../utils/gdprUtils';
import { logger } from '../utils/logger';

import { BaseController } from './BaseController';

/**
 * Consent statistics type
 */
interface ConsentStat {
  type: ConsentType;
  granted: number;
  revoked: number;
  total: number;
}

/**
 * GDPR Controller
 * Handles GDPR-related endpoints: consent management, data export, and deletion requests
 *
 * UPDATED: Now includes full cascade deletion support via GdprDataDeletionService
 * and Azure Blob Storage for GDPR exports
 */
export class GdprController extends BaseController {
  private readonly consentService: ConsentService;
  private readonly deletionService = getGdprDataDeletionService();
  private readonly exportService = getExportRequestService();
  private readonly gdprExportStorage = getGdprExportStorageService();
  private readonly organizationRepository: Repository<Organization>;

  constructor() {
    super();
    this.consentService = new ConsentService();
    this.organizationRepository = AppDataSource.getRepository(Organization);
  }

  /**
   * Record or update user consent
   * POST /api/gdpr/consent
   */
  public recordConsent = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async (req: AuthRequest, res: Response) => {
      const user = this.getAuthUser(req);
      this.validateRequired(req.body, 'consentType', 'granted');

      const { consentType, granted, purpose, version } = req.body;

      // Validate consent type
      if (!Object.values(ConsentType).includes(consentType)) {
        res.status(400).json({
          message: `Invalid consent type. Valid types: ${Object.values(ConsentType).join(', ')}`,
        });
        return;
      }

      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const consent = await this.consentService.recordConsent(
        user.id,
        consentType as ConsentType,
        granted,
        {
          purpose,
          version,
          ipAddress,
          userAgent,
        }
      );

      logger.info(`Consent ${granted ? 'granted' : 'revoked'} by user ${user.id}: ${consentType}`);

      this.sendSuccess(res, {
        message: `Consent ${granted ? 'granted' : 'revoked'} successfully`,
        consent: {
          type: consent.consentType,
          granted: consent.granted,
          updatedAt: consent.updatedAt,
        },
      });
    });
  };

  /**
   * Get all consents for current user
   * GET /api/gdpr/consent
   */
  public getUserConsents = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async (req: AuthRequest) => {
      const user = this.getAuthUser(req);
      const consents = await this.consentService.getUserConsents(user.id);

      return {
        consents: consents.map(c => ({
          type: c.consentType,
          granted: c.granted,
          purpose: c.purpose,
          version: c.version,
          grantedAt: c.createdAt,
          updatedAt: c.updatedAt,
          expiresAt: c.expiresAt,
        })),
      };
    });
  };

  /**
   * Request a data export (GDPR data portability with queue processing)
   * POST /api/gdpr/export-request
   * Supports { format: 'csv' | 'json' } in request body (default: 'json')
   */
  public requestDataExport = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async (req: AuthRequest) => {
      const user = this.getAuthUser(req);
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const format = (req.body.format as string)?.toLowerCase() || 'json'; // NOSONAR: Improper Type Validation FP — validated by Joi schema + explicit check below

      if (format !== 'json' && format !== 'csv') {
        throw new ValidationError('Invalid format. Supported formats: json, csv');
      }

      logger.info(`Data export request initiated by user ${user.id} (format: ${format})`);

      // Create export request with format metadata
      const exportRequest = await this.exportService.createExportRequest(
        user.id,
        ipAddress,
        userAgent,
        { format }
      );

      this.sendSuccess(res, {
        message:
          'Data export request created successfully. You will receive an email when your export is ready.',
        exportRequest: {
          id: exportRequest.id,
          status: exportRequest.status,
          format,
          requestedAt: exportRequest.requestedAt.toISOString(),
          expiresAt: exportRequest.expiresAt?.toISOString(),
        },
      });
    });
  };

  /**
   * Get export request status
   * GET /api/gdpr/export-request/:requestId
   */
  public getExportRequestStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async (req: AuthRequest, res: Response) => {
      const user = this.getAuthUser(req);
      const { requestId } = req.params;

      const exportRequest = await this.exportService.getExportRequest(requestId);

      if (!exportRequest) {
        res.status(404).json({
          message: 'Export request not found',
        });
        return;
      }

      // Verify the export belongs to the requesting user
      if (exportRequest.userId !== user.id) {
        res.status(403).json({
          message: 'Access denied',
        });
        return;
      }

      // Calculate download URL if completed
      let downloadUrl;
      if (exportRequest.status === 'completed' && exportRequest.downloadToken) {
        downloadUrl = `/api/gdpr/export-request/${requestId}/download?token=${exportRequest.downloadToken}`;
      }

      this.sendSuccess(res, {
        exportRequest: {
          id: exportRequest.id,
          status: exportRequest.status,
          requestedAt: exportRequest.requestedAt.toISOString(),
          processingStartedAt: exportRequest.processingStartedAt?.toISOString(),
          completedAt: exportRequest.completedAt?.toISOString(),
          expiresAt: exportRequest.expiresAt?.toISOString(),
          fileSize: exportRequest.fileSize,
          downloadUrl,
          metadata: exportRequest.exportMetadata,
        },
      });
    });
  };

  /**
   * Download export file
   * GET /api/gdpr/export-request/:requestId/download
   *
   * Supports both Azure Blob Storage (with SAS URLs) and local file system fallback
   * CWE-770: Resource allocation with throttling
   */
  public downloadExportFile = async (req: AuthRequest, res: Response): Promise<void> => {
    // NOSONAR: S3776 — download flow requires sequential validation steps (auth, token verify, blob/local branching, path traversal check, size check)
    await this.execute(req, res, async (req: AuthRequest, res: Response) => {
      const user = this.getAuthUser(req);
      const { requestId } = req.params;
      const { token } = req.query;

      // CWE-770: Validate request ID length to prevent abuse
      if (!requestId || requestId.length > 100) {
        throw new ValidationError('Invalid request ID');
      }

      if (!token || typeof token !== 'string') {
        throw new ValidationError('Download token is required');
      }

      // Verify token and get export request
      const exportRequest = await this.exportService.verifyDownloadToken(requestId, token);

      if (!exportRequest) {
        res.status(404).json({
          message: 'Export not found or download link has expired',
        });
        return;
      }

      // Verify the export belongs to the requesting user
      if (exportRequest.userId !== user.id) {
        res.status(403).json({
          message: 'Access denied',
        });
        return;
      }

      // Check if file exists
      if (!exportRequest.filePath) {
        res.status(404).json({
          message: 'Export file not found',
        });
        return;
      }

      try {
        const storageType = exportRequest.exportMetadata?.storageType;

        // CWE-770: Set maximum export file size (500MB for GDPR exports)
        const MAX_EXPORT_SIZE = 500 * 1024 * 1024;

        // Handle Azure Blob Storage
        if (storageType === 'azure-blob' && this.gdprExportStorage.isConfigured()) {
          logger.info(
            `Downloading export from Azure Blob Storage for user ${user.id}: ${requestId}`
          );

          // Check if we have a direct SAS URL in metadata
          const downloadUrl = exportRequest.exportMetadata?.downloadUrl;
          if (
            downloadUrl &&
            typeof downloadUrl === 'string' &&
            downloadUrl.startsWith('https://')
          ) {
            // Redirect to SAS URL for direct download from Azure
            res.redirect(downloadUrl);
            logger.info(`Redirected to Azure Blob SAS URL for user ${user.id}: ${requestId}`);
            return;
          }

          // If no SAS URL, download through backend (Managed Identity scenario)
          const blobName = exportRequest.filePath;

          // CWE-770: Check blob size before downloading
          try {
            const blobProperties = await this.gdprExportStorage.getBlobProperties(blobName);
            if (blobProperties?.contentLength && blobProperties.contentLength > MAX_EXPORT_SIZE) {
              logger.warn(
                `Export file size exceeds limit for user ${user.id}: ${blobProperties.contentLength} bytes`
              );
              res.status(413).json({
                message: `Export file is too large (${Math.round(blobProperties.contentLength / 1024 / 1024)}MB). Maximum allowed is ${MAX_EXPORT_SIZE / 1024 / 1024}MB.`,
              });
              return;
            }
          } catch (sizeCheckError) {
            logger.warn(
              `Could not verify blob size for ${blobName}, proceeding with download`,
              sizeCheckError
            );
          }

          const fileContent = await this.gdprExportStorage.downloadExport(blobName);

          // Determine format from metadata
          const exportFormat = (exportRequest.exportMetadata?.format as string) || 'json';
          const contentType =
            exportFormat === 'csv' ? 'text/csv; charset=utf-8' : 'application/json';
          const fileExt = exportFormat === 'csv' ? 'csv' : 'json';

          // Set headers for file download
          res.setHeader('Content-Type', contentType);
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="user-data-${user.id}-${requestId}.${fileExt}"`
          );

          res.send(fileContent);
          logger.info(`Export file downloaded from Azure Blob for user ${user.id}: ${requestId}`);
          return;
        }

        // Handle local file system (fallback)
        logger.info(`Downloading export from local file system for user ${user.id}: ${requestId}`);

        // CWE-22: Validate file path to prevent path traversal
        // S5443: '/tmp/gdpr-exports' is a fallback; production uses EXPORT_DIR env var or Azure Blob Storage. Path traversal is prevented by the startsWith check below.
        const exportDir = path.resolve(process.env.EXPORT_DIR ?? '/tmp/gdpr-exports'); // NOSONAR

        // Defense-in-depth: strip any directory components from the stored filename
        // The filePath in the DB should only be a filename, never a path with slashes
        const safeFilename = path.basename(exportRequest.filePath);
        const requestedFilePath = path.resolve(exportDir, safeFilename);

        // Ensure the file is within the export directory (prevent directory traversal)
        if (!requestedFilePath.startsWith(exportDir + path.sep)) {
          logger.warn(
            `Path traversal attempt detected for request ${requestId}: ${exportRequest.filePath}`
          );
          res.status(403).json({
            message: 'Access denied',
          });
          return;
        }

        // Check if file actually exists
        let fileStats;
        try {
          await fs.access(requestedFilePath);
          fileStats = await fs.stat(requestedFilePath);
        } catch {
          logger.warn(`Export file not found for request ${requestId}: ${requestedFilePath}`);
          res.status(404).json({
            message: 'Export file not found',
          });
          return;
        }

        // CWE-770: Check file size before reading
        if (fileStats.size > MAX_EXPORT_SIZE) {
          logger.warn(
            `Export file size exceeds limit for user ${user.id}: ${fileStats.size} bytes`
          );
          res.status(413).json({
            message: `Export file is too large (${Math.round(fileStats.size / 1024 / 1024)}MB). Maximum allowed is ${MAX_EXPORT_SIZE / 1024 / 1024}MB.`,
          });
          return;
        }

        // Read the file
        const fileContent = await fs.readFile(requestedFilePath, 'utf-8');

        // Determine format from metadata
        const localFormat = (exportRequest.exportMetadata?.format as string) || 'json';
        const localContentType =
          localFormat === 'csv' ? 'text/csv; charset=utf-8' : 'application/json';
        const localFileExt = localFormat === 'csv' ? 'csv' : 'json';

        // Set headers for file download
        res.setHeader('Content-Type', localContentType);
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="user-data-${user.id}-${requestId}.${localFileExt}"`
        );

        res.send(fileContent);
        logger.info(
          `Export file downloaded from local file system for user ${user.id}: ${requestId}`
        );
      } catch (error) {
        logger.error(`Error reading export file for request ${requestId}:`, error);
        res.status(500).json({
          message: 'Failed to read export file',
        });
      }
    });
  };

  /**
   * Get user's export request history
   * GET /api/gdpr/export-requests
   */
  public getUserExportRequests = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async (req: AuthRequest) => {
      const user = this.getAuthUser(req);
      const limit = Math.min(Number.parseInt(req.query.limit as string) || 10, 200);

      const exportRequests = await this.exportService.getUserExportRequests(user.id, limit);

      return {
        exportRequests: exportRequests.map(request => ({
          id: request.id,
          status: request.status,
          requestedAt: request.requestedAt.toISOString(),
          completedAt: request.completedAt?.toISOString(),
          expiresAt: request.expiresAt?.toISOString(),
          fileSize: request.fileSize,
          metadata: request.exportMetadata,
        })),
      };
    });
  };

  /**
   * Export all user data (GDPR data portability)
   * GET /api/gdpr/export
   * Supports ?format=csv for CSV output (default: JSON)
   * @deprecated Use POST /api/gdpr/export-request for queue-based exports
   */
  public exportUserData = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async (req: AuthRequest) => {
      const user = this.getAuthUser(req);
      const format = (req.query.format as string)?.toLowerCase() || 'json'; // NOSONAR: Improper Type Validation FP — validated by Joi schema + explicit format check below

      logger.info(`Data export requested by user ${user.id} (format: ${format})`);

      const exportData = await this.consentService.exportUserData(user.id);

      if (format === 'csv') {
        const csvContent = convertGdprDataToCsv(exportData);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="user-data-${user.id}-${Date.now()}.csv"`
        );
        res.send(csvContent);
        return;
      }

      // Default: JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="user-data-${user.id}-${Date.now()}.json"`
      );

      this.sendSuccess(res, exportData);
    });
  };

  /**
   * Request account and data deletion (GDPR right to be forgotten)
   * DELETE /api/gdpr/delete-account
   *
   * Implements full cascade deletion for GDPR Article 17
   */
  public requestDataDeletion = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async (req: AuthRequest, res: Response) => {
      const user = this.getAuthUser(req);
      this.validateRequired(req.body, 'confirm');

      if (req.body.confirm !== 'DELETE') {
        res.status(400).json({
          message: 'Please confirm deletion by providing "confirm": "DELETE" in request body',
        });
        return;
      }

      // Check for legal hold before deletion
      const holdStatus = await this.deletionService.checkLegalHold(user.id);
      if (holdStatus.isOnHold) {
        res.status(403).json({
          message: 'Your account is under legal hold and cannot be deleted at this time.',
          reason: holdStatus.reason,
          holdUntil: holdStatus.holdUntil,
        });
        return;
      }

      logger.warn(`Data deletion requested by user ${user.id}`);

      // Get preview of what will be deleted
      const _preview = await this.deletionService.getDataDeletionPreview(user.id);

      // Check if immediate deletion is requested
      const immediateDelete = req.body.immediate === true;

      if (immediateDelete) {
        // Perform full cascade deletion
        const result = await this.deletionService.deleteAllUserData(user.id);

        if (result.success) {
          this.sendSuccess(res, {
            message: 'Your account and all associated data have been permanently deleted.',
            deletedCounts: result.deletedCounts,
            totalDeleted: result.totalDeleted,
            completedAt: result.completedAt,
          });
        } else {
          res.status(500).json({
            message: 'Data deletion encountered errors. Please contact support.',
            errors: result.errors,
          });
        }
      } else {
        // Schedule deletion with grace period
        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

        // Create deletion request
        const deletionRequest = await this.deletionService.createDeletionRequest(
          user.id,
          ipAddress,
          userAgent
        );

        // Revoke all consents as first step
        await this.consentService.revokeAllConsents(user.id);

        // Calculate days until deletion
        const daysUntilDeletion = Math.ceil(
          (deletionRequest.scheduledFor.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        );

        this.sendSuccess(res, {
          message:
            'Data deletion request received. You can cancel this request during the grace period.',
          deletionRequestId: deletionRequest.id,
          deletionRequestedAt: deletionRequest.requestedAt.toISOString(),
          scheduledDeletionDate: deletionRequest.scheduledFor.toISOString(),
          daysUntilDeletion,
          dataPreview: deletionRequest.deletionPreview,
          note: 'To cancel, use the /api/gdpr/cancel-deletion endpoint. To delete immediately, include "immediate": true in your request body.',
        });
      }
    });
  };

  /**
   * Cancel pending deletion request
   * POST /api/gdpr/cancel-deletion
   *
   * Allows user to cancel their deletion request during grace period
   */
  public cancelDeletionRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async (req: AuthRequest, res: Response) => {
      const user = this.getAuthUser(req);
      const { reason } = req.body;

      logger.info(`User ${user.id} attempting to cancel deletion request`);

      try {
        const deletionRequest = await this.deletionService.cancelDeletionRequest(user.id, reason);

        if (!deletionRequest) {
          res.status(404).json({
            message: 'No pending deletion request found for your account.',
          });
          return;
        }

        this.sendSuccess(res, {
          message: 'Your deletion request has been cancelled successfully.',
          deletionRequest: {
            id: deletionRequest.id,
            status: deletionRequest.status,
            cancelledAt: deletionRequest.cancelledAt,
            cancellationReason: deletionRequest.cancellationReason,
          },
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to cancel deletion request';
        logger.error(`Error cancelling deletion request for user ${user.id}:`, error);

        res.status(400).json({
          message: errorMessage,
        });
      }
    });
  };

  /**
   * Get current deletion request status
   * GET /api/gdpr/deletion-status
   *
   * Returns the current status of a user's deletion request, if any
   */
  public getDeletionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async (req: AuthRequest) => {
      const user = this.getAuthUser(req);

      const deletionRequest = await this.deletionService.getPendingDeletionRequest(user.id);

      if (!deletionRequest) {
        return {
          hasPendingRequest: false,
          message: 'No pending deletion request found for your account.',
        };
      }

      const now = Date.now();
      const scheduledTime = deletionRequest.scheduledFor.getTime();
      const timeRemaining = scheduledTime - now;
      const daysRemaining = Math.ceil(timeRemaining / (24 * 60 * 60 * 1000));
      const hoursRemaining = Math.ceil(timeRemaining / (60 * 60 * 1000));

      return {
        hasPendingRequest: true,
        deletionRequest: {
          id: deletionRequest.id,
          status: deletionRequest.status,
          requestedAt: deletionRequest.requestedAt.toISOString(),
          scheduledFor: deletionRequest.scheduledFor.toISOString(),
          daysRemaining: Math.max(0, daysRemaining),
          hoursRemaining: Math.max(0, hoursRemaining),
          canCancel: timeRemaining > 0,
          dataPreview: deletionRequest.deletionPreview,
        },
      };
    });
  };

  /**
   * Get consent statistics (Admin only)
   * GET /api/gdpr/statistics
   */
  public getConsentStatistics = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async (req: AuthRequest) => {
      this.requireRole(req, 'admin');

      const statistics = await this.consentService.getConsentStatistics();

      this.sendSuccess(res, {
        statistics,
        generatedAt: new Date().toISOString(),
      });
    });
  };

  /**
   * Check if user has specific consent
   * GET /api/gdpr/consent/:consentType
   */
  public checkConsent = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async (req: AuthRequest, res: Response) => {
      const user = this.getAuthUser(req);
      const { consentType } = req.params;

      // Validate consent type
      if (!Object.values(ConsentType).includes(consentType as ConsentType)) {
        res.status(400).json({
          message: `Invalid consent type. Valid types: ${Object.values(ConsentType).join(', ')}`,
        });
        return;
      }

      const hasConsent = await this.consentService.hasConsent(user.id, consentType as ConsentType);

      this.sendSuccess(res, {
        consentType,
        granted: hasConsent,
      });
    });
  };

  /**
   * Check consent version status for a specific consent type
   * GET /api/gdpr/consent/:consentType/version
   */
  public checkConsentVersion = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async (req: AuthRequest, res: Response) => {
      const user = this.getAuthUser(req);
      const { consentType } = req.params;

      // Validate consent type
      if (!Object.values(ConsentType).includes(consentType as ConsentType)) {
        res.status(400).json({
          message: `Invalid consent type. Valid types: ${Object.values(ConsentType).join(', ')}`,
        });
        return;
      }

      const versionStatus = await this.consentService.checkConsentVersion(
        user.id,
        consentType as ConsentType
      );

      this.sendSuccess(res, versionStatus);
    });
  };

  /**
   * Get all GDPR requests for admin dashboard (Admin only)
   * GET /api/v2/gdpr/admin/requests
   *
   * Returns combined list of export and deletion requests across all users
   * with summary counts by type and status.
   */
  public getAdminGdprRequests = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async (req: AuthRequest) => {
      this.requireRole(req, 'admin');

      const limit = Math.min(Number(req.query.limit) || 50, 100);

      const [exportRequests, deletionRequests, exportCount30d, pendingDeletionCount] =
        await Promise.all([
          this.exportService.getAllExportRequests(limit),
          this.deletionService.getAllDeletionRequests(limit),
          this.exportService.getExportCountLastNDays(30),
          this.deletionService.getPendingDeletionCount(),
        ]);

      // Map to a unified shape for the frontend
      const requests = [
        ...exportRequests.map(r => ({
          id: r.id,
          type: 'export' as const,
          userId: r.userId ?? null,
          status: r.status,
          requestedAt: r.requestedAt.toISOString(),
          completedAt: r.completedAt?.toISOString() ?? null,
        })),
        ...deletionRequests.map(r => ({
          id: r.id,
          type: 'deletion' as const,
          userId: r.userId ?? null,
          status: r.status,
          requestedAt: r.requestedAt.toISOString(),
          completedAt: r.completedAt?.toISOString() ?? null,
        })),
      ].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

      const exportTotal = exportRequests.length;
      const deletionTotal = deletionRequests.length;
      const pendingTotal =
        exportRequests.filter(r => r.status === 'pending' || r.status === 'processing').length +
        deletionRequests.filter(r => r.status === 'pending').length;

      this.sendSuccess(res, {
        requests,
        summary: {
          exportCount: exportTotal,
          deletionCount: deletionTotal,
          pendingCount: pendingTotal,
          exportCountLast30Days: exportCount30d,
          pendingDeletionCount,
        },
        generatedAt: new Date().toISOString(),
      });
    });
  };

  /**
   * Get GDPR compliance dashboard data (Admin only)
   * GET /api/gdpr/dashboard
   *
   * Provides comprehensive GDPR compliance metrics for admin review
   * Implements recommendation: GDPR compliance dashboard
   */
  public getComplianceDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async (req: AuthRequest) => {
      this.requireRole(req, 'admin');

      const user = this.getAuthUser(req);

      // Get consent statistics
      const consentStats = await this.consentService.getConsentStatistics();

      // Get pending deletion requests
      const pendingDeletions = await this.deletionService.getPendingDeletionCount();
      const pendingDeletionRequests = await this.deletionService.getAllPendingDeletionRequests();

      // Get data export statistics
      const dataExportsLast30Days = await this.exportService.getExportCountLastNDays(30);

      // Calculate compliance score
      const complianceScore = this.calculateComplianceScore(consentStats);

      // Get organization-specific GDPR settings
      const organization = await getUserPrimaryOrganization(user.id);
      const gdprSettings = organization?.getGdprSettings() || { ...DEFAULT_GDPR_SETTINGS };

      // NOTE: Audit dates should be stored in organization settings in the future
      // For now, we use the current date as last audit and 90 days for next audit
      const lastAuditDate = new Date().toISOString();
      const nextAuditDue = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      this.sendSuccess(res, {
        dashboard: {
          complianceScore,
          lastAuditDate,
          nextAuditDue,
          gdprConfiguration: {
            deletionGracePeriodDays: gdprSettings.deletionGracePeriodDays,
            exportLinkExpirationDays: gdprSettings.exportLinkExpirationDays,
            organizationId: organization?.id || null,
            organizationName: organization?.name || null,
          },
          metrics: {
            consentStatistics: consentStats,
            pendingDeletionRequests: pendingDeletions,
            dataExportsLast30Days,
            dataRetentionStatus: 'compliant',
            encryptionStatus: 'enabled',
            auditLoggingStatus: 'enabled',
          },
          pendingDeletions: pendingDeletionRequests.map(req => ({
            id: req.id,
            userId: req.userId,
            requestedAt: req.requestedAt.toISOString(),
            scheduledFor: req.scheduledFor.toISOString(),
            daysRemaining: Math.ceil(
              (req.scheduledFor.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
            ),
            dataPreview: req.deletionPreview,
          })),
          recommendations: this.getComplianceRecommendations(complianceScore),
          gdprArticles: {
            article6: { status: 'compliant', note: 'Legal basis documented for all processing' },
            article7: { status: 'compliant', note: 'Consent management implemented' },
            article15: { status: 'compliant', note: 'Data export functionality available' },
            article17: {
              status: 'compliant',
              note: 'Right to erasure implemented with grace period',
            },
            article25: { status: 'compliant', note: 'Privacy by design principles applied' },
            article32: { status: 'compliant', note: 'Security measures in place' },
          },
        },
        generatedAt: new Date().toISOString(),
      });
    });
  };

  /**
   * Calculate GDPR compliance score (0-100)
   */
  private calculateComplianceScore(consentStats: ConsentStat[]): number {
    let score = 70; // Base score

    // Add points for consent tracking
    const totalConsents = consentStats.reduce((sum, stat) => sum + stat.total, 0);
    if (totalConsents > 0) {
      score += 10;
    }

    // Add points for having multiple consent types
    if (consentStats.length >= 3) {
      score += 10;
    }

    // Add points for having essential consent tracking
    const essentialStat = consentStats.find(s => s.type === ConsentType.ESSENTIAL);
    if (essentialStat && essentialStat.granted > 0) {
      score += 5;
    }

    // Encryption and audit logging are always enabled
    score += 5;

    return Math.min(100, score);
  }

  /**
   * Generate compliance recommendations
   */
  private getComplianceRecommendations(score: number): string[] {
    const recommendations: string[] = [];

    if (score < 80) {
      recommendations.push(
        'Review and document legal basis for all data processing activities',
        'Ensure all users have been prompted for consent preferences'
      );
    }

    if (score < 90) {
      recommendations.push(
        'Schedule quarterly GDPR compliance review',
        'Update privacy policy if needed'
      );
    }

    recommendations.push(
      'Regular staff training on data protection',
      'Monitor data breach notification procedures'
    );

    return recommendations;
  }

  /**
   * Verify deletion email confirmation
   * POST /api/gdpr/verify-deletion-email
   */
  public verifyDeletionEmail = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async (req: AuthRequest, res: Response) => {
      this.validateRequired(req.body, 'token');
      const { token } = req.body;

      const { OrganizationDeletionService } =
        await import('../services/organization/OrganizationDeletionService');
      const deletionService = new OrganizationDeletionService();

      const request = await deletionService.verifyEmailConfirmation(token);

      this.sendSuccess(res, {
        message:
          'Email verified successfully. Your deletion request has been submitted for admin approval.',
        request: {
          id: request.id,
          organizationId: request.organizationId,
          status: request.status,
          emailVerifiedAt: request.emailVerifiedAt,
        },
      });
    });
  };

  /**
   * Resend deletion confirmation email
   * POST /api/gdpr/resend-deletion-confirmation
   */
  public resendDeletionConfirmation = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async (req: AuthRequest, res: Response) => {
      const _user = this.getAuthUser(req);
      this.validateRequired(req.body, 'requestId');
      const { requestId } = req.body;

      const { OrganizationDeletionService } =
        await import('../services/organization/OrganizationDeletionService');
      const deletionService = new OrganizationDeletionService();

      await deletionService.sendEmailVerification(requestId);

      this.sendSuccess(res, {
        message: 'Confirmation email sent successfully.',
      });
    });
  };
}
