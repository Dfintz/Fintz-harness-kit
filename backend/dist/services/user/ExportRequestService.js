"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportRequestService = void 0;
exports.getExportRequestService = getExportRequestService;
const crypto_1 = __importDefault(require("crypto"));
const promises_1 = __importDefault(require("fs/promises"));
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const ExportRequest_1 = require("../../models/ExportRequest");
const Organization_1 = require("../../models/Organization");
const gdprCsvExporter_1 = require("../../utils/gdprCsvExporter");
const gdprUtils_1 = require("../../utils/gdprUtils");
const logger_1 = require("../../utils/logger");
const GdprExportStorageService_1 = require("../cloud/GdprExportStorageService");
const ConsentService_1 = require("./ConsentService");
class ExportRequestService {
    exportRequestRepository;
    consentService;
    gdprExportStorage = (0, GdprExportStorageService_1.getGdprExportStorageService)();
    DEFAULT_EXPIRATION_DAYS = 7;
    HOURS_PER_DAY = 24;
    constructor() {
        this.exportRequestRepository = data_source_1.AppDataSource.getRepository(ExportRequest_1.ExportRequest);
        this.consentService = new ConsentService_1.ConsentService();
    }
    async getExpirationDays(userId) {
        const organization = await (0, gdprUtils_1.getUserPrimaryOrganization)(userId);
        if (organization) {
            const gdprSettings = organization.getGdprSettings();
            const expirationDays = Math.max(Organization_1.MIN_EXPORT_EXPIRATION_DAYS, Math.min(Organization_1.MAX_EXPORT_EXPIRATION_DAYS, gdprSettings.exportLinkExpirationDays));
            return expirationDays;
        }
        return this.DEFAULT_EXPIRATION_DAYS;
    }
    async createExportRequest(userId, ipAddress, userAgent, options) {
        try {
            const requestId = crypto_1.default.randomUUID();
            const requestedAt = new Date();
            const exportRequest = this.exportRequestRepository.create({
                id: requestId,
                userId,
                status: ExportRequest_1.ExportRequestStatus.PENDING,
                requestedAt,
                requestIpAddress: ipAddress,
                requestUserAgent: userAgent,
                notificationSent: false,
                exportMetadata: options?.format ? { requestedFormat: options.format } : undefined,
            });
            await this.exportRequestRepository.save(exportRequest);
            logger_1.logger.info(`Export request created for user ${userId}: ${requestId} (format: ${options?.format || 'json'})`);
            return exportRequest;
        }
        catch (error) {
            logger_1.logger.error('Error creating export request:', error);
            throw new Error('Failed to create export request');
        }
    }
    async getExportRequest(requestId) {
        try {
            return await this.exportRequestRepository.findOne({
                where: { id: requestId },
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching export request:', error);
            throw new Error('Failed to fetch export request');
        }
    }
    async getUserExportRequests(userId, limit = 10) {
        try {
            return await this.exportRequestRepository.find({
                where: { userId },
                order: { requestedAt: 'DESC' },
                take: limit,
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching user export requests:', error);
            throw new Error('Failed to fetch export requests');
        }
    }
    async getPendingExportRequests(limit = 10) {
        try {
            return await this.exportRequestRepository.find({
                where: { status: ExportRequest_1.ExportRequestStatus.PENDING },
                order: { requestedAt: 'ASC' },
                take: limit,
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching pending export requests:', error);
            throw new Error('Failed to fetch pending export requests');
        }
    }
    async processExportRequest(requestId) {
        const exportRequest = await this.getExportRequest(requestId);
        if (!exportRequest) {
            throw new Error('Export request not found');
        }
        if (exportRequest.status !== ExportRequest_1.ExportRequestStatus.PENDING) {
            throw new Error(`Export request ${requestId} is not in PENDING status`);
        }
        try {
            exportRequest.status = ExportRequest_1.ExportRequestStatus.PROCESSING;
            exportRequest.processingStartedAt = new Date();
            await this.exportRequestRepository.save(exportRequest);
            if (!exportRequest.userId) {
                throw new Error('Export request has no userId');
            }
            const userId = exportRequest.userId;
            logger_1.logger.info(`Processing export request ${requestId} for user ${userId}`);
            const exportData = await this.consentService.exportUserData(userId);
            const requestedFormat = exportRequest.exportMetadata?.requestedFormat || 'json';
            const isCsv = requestedFormat === 'csv';
            const serializedContent = isCsv
                ? (0, gdprCsvExporter_1.convertGdprDataToCsv)(exportData)
                : JSON.stringify(exportData, null, 2);
            const expirationDays = await this.getExpirationDays(userId);
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expirationDays);
            let filePath;
            let fileSize;
            let downloadUrl;
            if (this.gdprExportStorage.isConfigured()) {
                logger_1.logger.info('Using Azure Blob Storage for GDPR export');
                const blobName = await this.gdprExportStorage.uploadExport(userId, requestId, exportData);
                downloadUrl = await this.gdprExportStorage.generateSasUrl(blobName, expirationDays * this.HOURS_PER_DAY);
                filePath = blobName;
                fileSize = String(Buffer.byteLength(serializedContent, 'utf-8'));
                logger_1.logger.info('GDPR export stored in Azure Blob Storage', {
                    requestId,
                    userId: exportRequest.userId,
                    blobName,
                    fileSize,
                });
            }
            else {
                logger_1.logger.error('Azure Blob Storage not configured — cannot process GDPR export');
                throw new Error('GDPR export storage is not configured. Set AZURE_STORAGE_ACCOUNT_NAME or AZURE_STORAGE_CONNECTION_STRING.');
            }
            const downloadToken = this.generateDownloadToken(requestId, userId);
            exportRequest.status = ExportRequest_1.ExportRequestStatus.COMPLETED;
            exportRequest.completedAt = new Date();
            exportRequest.filePath = filePath;
            exportRequest.fileSize = fileSize;
            exportRequest.downloadToken = downloadToken;
            exportRequest.expiresAt = expiresAt;
            exportRequest.exportMetadata = this.extractExportMetadata(exportData);
            exportRequest.exportMetadata.format = requestedFormat;
            if (downloadUrl) {
                exportRequest.exportMetadata = {
                    ...exportRequest.exportMetadata,
                    downloadUrl,
                    storageType: 'azure-blob',
                };
            }
            else {
                exportRequest.exportMetadata = {
                    ...exportRequest.exportMetadata,
                    storageType: 'local-file',
                };
            }
            await this.exportRequestRepository.save(exportRequest);
            logger_1.logger.info(`Export request ${requestId} completed successfully, expires in ${expirationDays} days`);
            return exportRequest;
        }
        catch (error) {
            logger_1.logger.error(`Error processing export request ${requestId}:`, error);
            exportRequest.status = ExportRequest_1.ExportRequestStatus.FAILED;
            exportRequest.failureReason = error instanceof Error ? error.message : 'Unknown error';
            await this.exportRequestRepository.save(exportRequest);
            throw error;
        }
    }
    async verifyDownloadToken(requestId, token) {
        try {
            const exportRequest = await this.getExportRequest(requestId);
            if (!exportRequest) {
                return null;
            }
            if (exportRequest.status !== ExportRequest_1.ExportRequestStatus.COMPLETED) {
                return null;
            }
            if (exportRequest.downloadToken !== token) {
                logger_1.logger.warn(`Invalid download token for export request ${requestId}`);
                return null;
            }
            if (exportRequest.expiresAt && new Date() > exportRequest.expiresAt) {
                exportRequest.status = ExportRequest_1.ExportRequestStatus.EXPIRED;
                await this.exportRequestRepository.save(exportRequest);
                logger_1.logger.warn(`Export request ${requestId} has expired`);
                return null;
            }
            return exportRequest;
        }
        catch (error) {
            logger_1.logger.error('Error verifying download token:', error);
            throw new Error('Failed to verify download token');
        }
    }
    async markNotificationSent(requestId) {
        try {
            await this.exportRequestRepository.update({ id: requestId }, { notificationSent: true });
        }
        catch (error) {
            logger_1.logger.error('Error marking notification as sent:', error);
            throw new Error('Failed to mark notification as sent');
        }
    }
    async cleanupExpiredExports() {
        try {
            const now = new Date();
            const expiredRequests = await this.exportRequestRepository.find({
                where: {
                    status: ExportRequest_1.ExportRequestStatus.COMPLETED,
                    expiresAt: (0, typeorm_1.LessThanOrEqual)(now),
                },
            });
            let cleanedCount = 0;
            for (const request of expiredRequests) {
                try {
                    if (request.filePath) {
                        const storageType = request.exportMetadata?.storageType;
                        if (storageType === 'azure-blob' && this.gdprExportStorage.isConfigured()) {
                            await this.gdprExportStorage.deleteExport(request.filePath).catch(err => {
                                logger_1.logger.warn(`Failed to delete export blob ${request.filePath}:`, err);
                            });
                        }
                        else {
                            await promises_1.default.unlink(request.filePath).catch(err => {
                                logger_1.logger.warn(`Failed to delete export file ${request.filePath}:`, err);
                            });
                        }
                    }
                    request.status = ExportRequest_1.ExportRequestStatus.EXPIRED;
                    request.filePath = undefined;
                    request.downloadToken = undefined;
                    await this.exportRequestRepository.save(request);
                    cleanedCount++;
                }
                catch (error) {
                    logger_1.logger.error(`Error cleaning up export request ${request.id}:`, error);
                }
            }
            if (cleanedCount > 0) {
                logger_1.logger.info(`Cleaned up ${cleanedCount} expired export requests`);
            }
            return cleanedCount;
        }
        catch (error) {
            logger_1.logger.error('Error cleaning up expired exports:', error);
            return 0;
        }
    }
    async deleteExportRequest(requestId) {
        const exportRequest = await this.getExportRequest(requestId);
        if (!exportRequest) {
            throw new Error('Export request not found');
        }
        if (exportRequest.status === ExportRequest_1.ExportRequestStatus.PROCESSING) {
            throw new Error('Cannot delete an export that is currently processing');
        }
        if (exportRequest.filePath) {
            const storageType = exportRequest.exportMetadata?.storageType;
            if (storageType === 'azure-blob' && this.gdprExportStorage.isConfigured()) {
                await this.gdprExportStorage.deleteExport(exportRequest.filePath).catch(err => {
                    logger_1.logger.warn(`Failed to delete export blob ${exportRequest.filePath}:`, err);
                });
            }
            else {
                await promises_1.default.unlink(exportRequest.filePath).catch(err => {
                    logger_1.logger.warn(`Failed to delete export file ${exportRequest.filePath}:`, err);
                });
            }
        }
        exportRequest.status = ExportRequest_1.ExportRequestStatus.EXPIRED;
        exportRequest.filePath = undefined;
        exportRequest.downloadToken = undefined;
        await this.exportRequestRepository.save(exportRequest);
        logger_1.logger.info(`Export request ${requestId} deleted by user`);
    }
    async getExportCountLastNDays(days) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            return await this.exportRequestRepository.count({
                where: {
                    requestedAt: (0, typeorm_1.MoreThanOrEqual)(cutoffDate),
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting export count:', error);
            return 0;
        }
    }
    async getAllExportRequests(limit = 50) {
        return this.exportRequestRepository.find({
            order: { requestedAt: 'DESC' },
            take: limit,
            select: ['id', 'userId', 'status', 'requestedAt', 'completedAt', 'fileSize'],
        });
    }
    generateDownloadToken(requestId, userId) {
        const secret = process.env.EXPORT_TOKEN_SECRET;
        if (!secret) {
            throw new Error('EXPORT_TOKEN_SECRET environment variable must be configured');
        }
        const data = `${requestId}:${userId}:${Date.now()}`;
        return crypto_1.default.createHmac('sha256', secret).update(data).digest('hex');
    }
    extractExportMetadata(exportData) {
        const metadata = {};
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
exports.ExportRequestService = ExportRequestService;
let exportRequestServiceInstance = null;
function getExportRequestService() {
    if (!exportRequestServiceInstance) {
        exportRequestServiceInstance = new ExportRequestService();
    }
    return exportRequestServiceInstance;
}
//# sourceMappingURL=ExportRequestService.js.map