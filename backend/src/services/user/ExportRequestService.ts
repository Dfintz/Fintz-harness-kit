import crypto from 'crypto';
import fs from 'fs/promises';

import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { ExportRequest, ExportRequestStatus } from '../../models/ExportRequest';
import { MAX_EXPORT_EXPIRATION_DAYS, MIN_EXPORT_EXPIRATION_DAYS } from '../../models/Organization';
import { convertGdprDataToCsv } from '../../utils/gdprCsvExporter';
import { getUserPrimaryOrganization } from '../../utils/gdprUtils';
import { logger } from '../../utils/logger';
import { getGdprExportStorageService } from '../cloud/GdprExportStorageService';

import { ConsentService } from './ConsentService';

/**
 * Export Request Service
 *
 * Manages GDPR data export requests with queue-based processing.
 * Features:
 * - Request tracking with status management
 * - Secure download token generation
 * - Azure Blob Storage for persistent, secure exports
 * - File expiration handling with automatic cleanup
 * - Export metadata tracking
 */
export class ExportRequestService {
  private readonly exportRequestRepository: Repository<ExportRequest>;
  private readonly consentService: ConsentService;
  private readonly gdprExportStorage = getGdprExportStorageService();

  // Default expiration time for export files (7 days)
  private readonly DEFAULT_EXPIRATION_DAYS = 7;

  // Hours per day constant for time conversions
  private readonly HOURS_PER_DAY = 24;

  constructor() {
    this.exportRequestRepository = AppDataSource.getRepository(ExportRequest);
    this.consentService = new ConsentService();
  }

  /**
   * Get the export expiration days for a user
   * Uses organization-specific settings or global defaults
   * @param userId User ID
   * @returns Number of days until export expires
   */
  private async getExpirationDays(userId: string): Promise<number> {
    const organization = await getUserPrimaryOrganization(userId);

    if (organization) {
      const gdprSettings = organization.getGdprSettings();
      // Validate the expiration days is within bounds
      const expirationDays = Math.max(
        MIN_EXPORT_EXPIRATION_DAYS,
        Math.min(MAX_EXPORT_EXPIRATION_DAYS, gdprSettings.exportLinkExpirationDays)
      );
      return expirationDays;
    }

    // Fall back to global default
    return this.DEFAULT_EXPIRATION_DAYS;
  }

  /**
   * Create a new export request
   * @param userId User ID requesting the export
   * @param ipAddress IP address of the request
   * @param userAgent User agent of the request
   * @param options Optional settings (e.g., format: 'json' | 'csv')
   * @returns Created export request
   */
  public async createExportRequest(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    options?: { format?: string }
  ): Promise<ExportRequest> {
    try {
      const requestId = crypto.randomUUID();
      const requestedAt = new Date();

      const exportRequest = this.exportRequestRepository.create({
        id: requestId,
        userId,
        status: ExportRequestStatus.PENDING,
        requestedAt,
        requestIpAddress: ipAddress,
        requestUserAgent: userAgent,
        notificationSent: false,
        exportMetadata: options?.format ? { requestedFormat: options.format } : undefined,
      });

      await this.exportRequestRepository.save(exportRequest);

      logger.info(
        `Export request created for user ${userId}: ${requestId} (format: ${options?.format || 'json'})`
      );

      return exportRequest;
    } catch (error: unknown) {
      logger.error('Error creating export request:', error);
      throw new Error('Failed to create export request');
    }
  }

  /**
   * Get export request by ID
   * @param requestId Export request ID
   * @returns Export request or null
   */
  public async getExportRequest(requestId: string): Promise<ExportRequest | null> {
    try {
      return await this.exportRequestRepository.findOne({
        where: { id: requestId },
      });
    } catch (error: unknown) {
      logger.error('Error fetching export request:', error);
      throw new Error('Failed to fetch export request');
    }
  }

  /**
   * Get user's export requests
   * @param userId User ID
   * @param limit Maximum number of requests to return
   * @returns Array of export requests
   */
  public async getUserExportRequests(userId: string, limit: number = 10): Promise<ExportRequest[]> {
    try {
      return await this.exportRequestRepository.find({
        where: { userId },
        order: { requestedAt: 'DESC' },
        take: limit,
      });
    } catch (error: unknown) {
      logger.error('Error fetching user export requests:', error);
      throw new Error('Failed to fetch export requests');
    }
  }

  /**
   * Get pending export requests for processing
   * @param limit Maximum number of requests to return
   * @returns Array of pending export requests
   */
  public async getPendingExportRequests(limit: number = 10): Promise<ExportRequest[]> {
    try {
      return await this.exportRequestRepository.find({
        where: { status: ExportRequestStatus.PENDING },
        order: { requestedAt: 'ASC' },
        take: limit,
      });
    } catch (error: unknown) {
      logger.error('Error fetching pending export requests:', error);
      throw new Error('Failed to fetch pending export requests');
    }
  }

  /**
   * Process an export request (generate the export file)
   * @param requestId Export request ID
   * @returns Updated export request
   */
  public async processExportRequest(requestId: string): Promise<ExportRequest> {
    const exportRequest = await this.getExportRequest(requestId);

    if (!exportRequest) {
      throw new Error('Export request not found');
    }

    if (exportRequest.status !== ExportRequestStatus.PENDING) {
      throw new Error(`Export request ${requestId} is not in PENDING status`);
    }

    try {
      // Update status to processing
      exportRequest.status = ExportRequestStatus.PROCESSING;
      exportRequest.processingStartedAt = new Date();
      await this.exportRequestRepository.save(exportRequest);

      if (!exportRequest.userId) {
        throw new Error('Export request has no userId');
      }

      const userId = exportRequest.userId; // Store in local variable for type narrowing

      logger.info(`Processing export request ${requestId} for user ${userId}`);

      // Generate the export data
      const exportData = await this.consentService.exportUserData(userId);

      // Determine requested format (default: json)
      const requestedFormat = (exportRequest.exportMetadata?.requestedFormat as string) || 'json';
      const isCsv = requestedFormat === 'csv';

      // Serialize based on format
      const serializedContent = isCsv
        ? convertGdprDataToCsv(exportData)
        : JSON.stringify(exportData, null, 2);

      // Calculate expiration date using organization-specific settings
      const expirationDays = await this.getExpirationDays(userId);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      let filePath: string;
      let fileSize: string;
      let downloadUrl: string | undefined;

      // Try to use Azure Blob Storage first
      if (this.gdprExportStorage.isConfigured()) {
        logger.info('Using Azure Blob Storage for GDPR export');

        // Upload to Azure Blob Storage
        const blobName = await this.gdprExportStorage.uploadExport(userId, requestId, exportData);

        // Generate SAS URL for download (valid for the expiration period)
        // Convert expiration days to hours for SAS URL
        downloadUrl = await this.gdprExportStorage.generateSasUrl(
          blobName,
          expirationDays * this.HOURS_PER_DAY
        );

        // Store blob name in filePath field (for cleanup)
        filePath = blobName;

        // Calculate file size from serialized content
        fileSize = String(Buffer.byteLength(serializedContent, 'utf-8'));

        logger.info('GDPR export stored in Azure Blob Storage', {
          requestId,
          userId: exportRequest.userId,
          blobName,
          fileSize,
        });
      } else {
        logger.error('Azure Blob Storage not configured — cannot process GDPR export');
        throw new Error(
          'GDPR export storage is not configured. Set AZURE_STORAGE_ACCOUNT_NAME or AZURE_STORAGE_CONNECTION_STRING.'
        );
      }

      // Generate secure download token
      const downloadToken = this.generateDownloadToken(requestId, userId);

      // Update export request with completion details
      exportRequest.status = ExportRequestStatus.COMPLETED;
      exportRequest.completedAt = new Date();
      exportRequest.filePath = filePath; // Contains blob name or local file path
      exportRequest.fileSize = fileSize;
      exportRequest.downloadToken = downloadToken;
      exportRequest.expiresAt = expiresAt;
      exportRequest.exportMetadata = this.extractExportMetadata(exportData);

      // Preserve format info in metadata
      exportRequest.exportMetadata.format = requestedFormat;

      // Store SAS URL in metadata if available (for reference)
      if (downloadUrl) {
        exportRequest.exportMetadata = {
          ...exportRequest.exportMetadata,
          downloadUrl,
          storageType: 'azure-blob',
        };
      } else {
        exportRequest.exportMetadata = {
          ...exportRequest.exportMetadata,
          storageType: 'local-file',
        };
      }

      await this.exportRequestRepository.save(exportRequest);

      logger.info(
        `Export request ${requestId} completed successfully, expires in ${expirationDays} days`
      );

      return exportRequest;
    } catch (error: unknown) {
      logger.error(`Error processing export request ${requestId}:`, error);

      // Update status to failed
      exportRequest.status = ExportRequestStatus.FAILED;
      exportRequest.failureReason = error instanceof Error ? error.message : 'Unknown error';
      await this.exportRequestRepository.save(exportRequest);

      throw error;
    }
  }

  /**
   * Verify download token and get export request
   * @param requestId Export request ID
   * @param token Download token
   * @returns Export request if token is valid
   */
  public async verifyDownloadToken(
    requestId: string,
    token: string
  ): Promise<ExportRequest | null> {
    try {
      const exportRequest = await this.getExportRequest(requestId);

      if (!exportRequest) {
        return null;
      }

      // Check if export is completed
      if (exportRequest.status !== ExportRequestStatus.COMPLETED) {
        return null;
      }

      // Check if token matches
      if (exportRequest.downloadToken !== token) {
        logger.warn(`Invalid download token for export request ${requestId}`);
        return null;
      }

      // Check if expired
      if (exportRequest.expiresAt && new Date() > exportRequest.expiresAt) {
        // Mark as expired if not already marked
        exportRequest.status = ExportRequestStatus.EXPIRED;
        await this.exportRequestRepository.save(exportRequest);
        logger.warn(`Export request ${requestId} has expired`);
        return null;
      }

      return exportRequest;
    } catch (error: unknown) {
      logger.error('Error verifying download token:', error);
      throw new Error('Failed to verify download token');
    }
  }

  /**
   * Mark export request notification as sent
   * @param requestId Export request ID
   */
  public async markNotificationSent(requestId: string): Promise<void> {
    try {
      await this.exportRequestRepository.update({ id: requestId }, { notificationSent: true });
    } catch (error: unknown) {
      logger.error('Error marking notification as sent:', error);
      throw new Error('Failed to mark notification as sent');
    }
  }

  /**
   * Clean up expired export requests
   * Deletes files from Azure Blob Storage or local file system and marks requests as expired
   * @returns Number of cleaned up requests
   */
  public async cleanupExpiredExports(): Promise<number> {
    try {
      const now = new Date();

      // Find completed exports that have expired
      const expiredRequests = await this.exportRequestRepository.find({
        where: {
          status: ExportRequestStatus.COMPLETED,
          expiresAt: LessThanOrEqual(now),
        },
      });

      let cleanedCount = 0;

      for (const request of expiredRequests) {
        try {
          // Delete the file if it exists
          if (request.filePath) {
            // Determine storage type from metadata
            const storageType = request.exportMetadata?.storageType;

            if (storageType === 'azure-blob' && this.gdprExportStorage.isConfigured()) {
              // Delete from Azure Blob Storage
              await this.gdprExportStorage.deleteExport(request.filePath).catch(err => {
                logger.warn(`Failed to delete export blob ${request.filePath}:`, err);
              });
            } else {
              // Delete from local file system (fallback)
              await fs.unlink(request.filePath).catch(err => {
                logger.warn(`Failed to delete export file ${request.filePath}:`, err);
              });
            }
          }

          // Mark as expired and clear file data
          request.status = ExportRequestStatus.EXPIRED;
          request.filePath = undefined;
          request.downloadToken = undefined;
          await this.exportRequestRepository.save(request);

          cleanedCount++;
        } catch (error: unknown) {
          logger.error(`Error cleaning up export request ${request.id}:`, error);
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} expired export requests`);
      }

      return cleanedCount;
    } catch (error: unknown) {
      logger.error('Error cleaning up expired exports:', error);
      return 0;
    }
  }

  /**
   * Delete (soft-expire) an individual export request and remove its file.
   * Cannot delete a request that is currently PROCESSING.
   */
  public async deleteExportRequest(requestId: string): Promise<void> {
    const exportRequest = await this.getExportRequest(requestId);
    if (!exportRequest) {
      throw new Error('Export request not found');
    }

    if (exportRequest.status === ExportRequestStatus.PROCESSING) {
      throw new Error('Cannot delete an export that is currently processing');
    }

    // Delete the backing file if present
    if (exportRequest.filePath) {
      const storageType = exportRequest.exportMetadata?.storageType;

      if (storageType === 'azure-blob' && this.gdprExportStorage.isConfigured()) {
        await this.gdprExportStorage.deleteExport(exportRequest.filePath).catch(err => {
          logger.warn(`Failed to delete export blob ${exportRequest.filePath}:`, err);
        });
      } else {
        await fs.unlink(exportRequest.filePath).catch(err => {
          logger.warn(`Failed to delete export file ${exportRequest.filePath}:`, err);
        });
      }
    }

    exportRequest.status = ExportRequestStatus.EXPIRED;
    exportRequest.filePath = undefined;
    exportRequest.downloadToken = undefined;
    await this.exportRequestRepository.save(exportRequest);

    logger.info(`Export request ${requestId} deleted by user`);
  }

  /**
   * Get count of exports in last N days
   * @param days Number of days to look back
   * @returns Count of export requests
   */
  public async getExportCountLastNDays(days: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      return await this.exportRequestRepository.count({
        where: {
          requestedAt: MoreThanOrEqual(cutoffDate),
        },
      });
    } catch (error: unknown) {
      logger.error('Error getting export count:', error);
      return 0;
    }
  }

  /**
   * Get all export requests across all users (for admin dashboard)
   * @param limit Maximum number of requests to return
   * @returns Array of export requests ordered by most recent first
   */
  public async getAllExportRequests(limit = 50): Promise<ExportRequest[]> {
    return this.exportRequestRepository.find({
      order: { requestedAt: 'DESC' },
      take: limit,
      select: ['id', 'userId', 'status', 'requestedAt', 'completedAt', 'fileSize'],
    });
  }

  /**
   * Generate secure download token
   * @param requestId Export request ID
   * @param userId User ID
   * @returns Download token
   */
  private generateDownloadToken(requestId: string, userId: string): string {
    const secret = process.env.EXPORT_TOKEN_SECRET;
    if (!secret) {
      throw new Error('EXPORT_TOKEN_SECRET environment variable must be configured');
    }
    const data = `${requestId}:${userId}:${Date.now()}`;

    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Extract metadata from export data
   * @param exportData Export data object
   * @returns Metadata summary
   */
  private extractExportMetadata(exportData: Record<string, unknown>): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    if (exportData.user) {
      metadata.userDataIncluded = true;
    }

    if (Array.isArray(exportData.consents)) {
      metadata.consentCount = exportData.consents.length;
    }

    if (Array.isArray(exportData.userShips)) {
      metadata.shipCount = exportData.userShips.length;
    }

    if (Array.isArray(exportData.userCreatedActivities)) {
      metadata.activityCount = exportData.userCreatedActivities.length;
    }

    if (Array.isArray(exportData.userOrganizations)) {
      metadata.organizationCount = exportData.userOrganizations.length;
    }

    if (Array.isArray(exportData.userActivityLogs)) {
      metadata.activityLogCount = exportData.userActivityLogs.length;
    }

    if (Array.isArray(exportData.userSessions)) {
      metadata.sessionCount = exportData.userSessions.length;
    }

    return metadata;
  }
}

/**
 * Singleton instance
 */
let exportRequestServiceInstance: ExportRequestService | null = null;

/**
 * Get singleton instance of ExportRequestService
 * @returns ExportRequestService instance
 */
export function getExportRequestService(): ExportRequestService {
  if (!exportRequestServiceInstance) {
    exportRequestServiceInstance = new ExportRequestService();
  }
  return exportRequestServiceInstance;
}

