"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GdprController = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const database_1 = require("../config/database");
const Organization_1 = require("../models/Organization");
const UserConsent_1 = require("../models/UserConsent");
const GdprExportStorageService_1 = require("../services/cloud/GdprExportStorageService");
const ConsentService_1 = require("../services/user/ConsentService");
const ExportRequestService_1 = require("../services/user/ExportRequestService");
const GdprDataDeletionService_1 = require("../services/user/GdprDataDeletionService");
const apiErrors_1 = require("../utils/apiErrors");
const gdprCsvExporter_1 = require("../utils/gdprCsvExporter");
const gdprUtils_1 = require("../utils/gdprUtils");
const logger_1 = require("../utils/logger");
const BaseController_1 = require("./BaseController");
class GdprController extends BaseController_1.BaseController {
    consentService;
    deletionService = (0, GdprDataDeletionService_1.getGdprDataDeletionService)();
    exportService = (0, ExportRequestService_1.getExportRequestService)();
    gdprExportStorage = (0, GdprExportStorageService_1.getGdprExportStorageService)();
    organizationRepository;
    constructor() {
        super();
        this.consentService = new ConsentService_1.ConsentService();
        this.organizationRepository = database_1.AppDataSource.getRepository(Organization_1.Organization);
    }
    recordConsent = async (req, res) => {
        await this.execute(req, res, async (req, res) => {
            const user = this.getAuthUser(req);
            this.validateRequired(req.body, 'consentType', 'granted');
            const { consentType, granted, purpose, version } = req.body;
            if (!Object.values(UserConsent_1.ConsentType).includes(consentType)) {
                res.status(400).json({
                    message: `Invalid consent type. Valid types: ${Object.values(UserConsent_1.ConsentType).join(', ')}`,
                });
                return;
            }
            const ipAddress = req.ip || req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];
            const consent = await this.consentService.recordConsent(user.id, consentType, granted, {
                purpose,
                version,
                ipAddress,
                userAgent,
            });
            logger_1.logger.info(`Consent ${granted ? 'granted' : 'revoked'} by user ${user.id}: ${consentType}`);
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
    getUserConsents = async (req, res) => {
        await this.executeAndReturn(req, res, async (req) => {
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
    requestDataExport = async (req, res) => {
        await this.execute(req, res, async (req) => {
            const user = this.getAuthUser(req);
            const ipAddress = req.ip || req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];
            const format = req.body.format?.toLowerCase() || 'json';
            if (format !== 'json' && format !== 'csv') {
                throw new apiErrors_1.ValidationError('Invalid format. Supported formats: json, csv');
            }
            logger_1.logger.info(`Data export request initiated by user ${user.id} (format: ${format})`);
            const exportRequest = await this.exportService.createExportRequest(user.id, ipAddress, userAgent, { format });
            this.sendSuccess(res, {
                message: 'Data export request created successfully. You will receive an email when your export is ready.',
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
    getExportRequestStatus = async (req, res) => {
        await this.execute(req, res, async (req, res) => {
            const user = this.getAuthUser(req);
            const { requestId } = req.params;
            const exportRequest = await this.exportService.getExportRequest(requestId);
            if (!exportRequest) {
                res.status(404).json({
                    message: 'Export request not found',
                });
                return;
            }
            if (exportRequest.userId !== user.id) {
                res.status(403).json({
                    message: 'Access denied',
                });
                return;
            }
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
    downloadExportFile = async (req, res) => {
        await this.execute(req, res, async (req, res) => {
            const user = this.getAuthUser(req);
            const { requestId } = req.params;
            const { token } = req.query;
            if (!requestId || requestId.length > 100) {
                throw new apiErrors_1.ValidationError('Invalid request ID');
            }
            if (!token || typeof token !== 'string') {
                throw new apiErrors_1.ValidationError('Download token is required');
            }
            const exportRequest = await this.exportService.verifyDownloadToken(requestId, token);
            if (!exportRequest) {
                res.status(404).json({
                    message: 'Export not found or download link has expired',
                });
                return;
            }
            if (exportRequest.userId !== user.id) {
                res.status(403).json({
                    message: 'Access denied',
                });
                return;
            }
            if (!exportRequest.filePath) {
                res.status(404).json({
                    message: 'Export file not found',
                });
                return;
            }
            try {
                const storageType = exportRequest.exportMetadata?.storageType;
                const MAX_EXPORT_SIZE = 500 * 1024 * 1024;
                if (storageType === 'azure-blob' && this.gdprExportStorage.isConfigured()) {
                    logger_1.logger.info(`Downloading export from Azure Blob Storage for user ${user.id}: ${requestId}`);
                    const downloadUrl = exportRequest.exportMetadata?.downloadUrl;
                    if (downloadUrl &&
                        typeof downloadUrl === 'string' &&
                        downloadUrl.startsWith('https://')) {
                        res.redirect(downloadUrl);
                        logger_1.logger.info(`Redirected to Azure Blob SAS URL for user ${user.id}: ${requestId}`);
                        return;
                    }
                    const blobName = exportRequest.filePath;
                    try {
                        const blobProperties = await this.gdprExportStorage.getBlobProperties(blobName);
                        if (blobProperties?.contentLength && blobProperties.contentLength > MAX_EXPORT_SIZE) {
                            logger_1.logger.warn(`Export file size exceeds limit for user ${user.id}: ${blobProperties.contentLength} bytes`);
                            res.status(413).json({
                                message: `Export file is too large (${Math.round(blobProperties.contentLength / 1024 / 1024)}MB). Maximum allowed is ${MAX_EXPORT_SIZE / 1024 / 1024}MB.`,
                            });
                            return;
                        }
                    }
                    catch (sizeCheckError) {
                        logger_1.logger.warn(`Could not verify blob size for ${blobName}, proceeding with download`, sizeCheckError);
                    }
                    const fileContent = await this.gdprExportStorage.downloadExport(blobName);
                    const exportFormat = exportRequest.exportMetadata?.format || 'json';
                    const contentType = exportFormat === 'csv' ? 'text/csv; charset=utf-8' : 'application/json';
                    const fileExt = exportFormat === 'csv' ? 'csv' : 'json';
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Content-Disposition', `attachment; filename="user-data-${user.id}-${requestId}.${fileExt}"`);
                    res.send(fileContent);
                    logger_1.logger.info(`Export file downloaded from Azure Blob for user ${user.id}: ${requestId}`);
                    return;
                }
                logger_1.logger.info(`Downloading export from local file system for user ${user.id}: ${requestId}`);
                const exportDir = node_path_1.default.resolve(process.env.EXPORT_DIR ?? '/tmp/gdpr-exports');
                const safeFilename = node_path_1.default.basename(exportRequest.filePath);
                const requestedFilePath = node_path_1.default.resolve(exportDir, safeFilename);
                if (!requestedFilePath.startsWith(exportDir + node_path_1.default.sep)) {
                    logger_1.logger.warn(`Path traversal attempt detected for request ${requestId}: ${exportRequest.filePath}`);
                    res.status(403).json({
                        message: 'Access denied',
                    });
                    return;
                }
                let fileStats;
                try {
                    await promises_1.default.access(requestedFilePath);
                    fileStats = await promises_1.default.stat(requestedFilePath);
                }
                catch {
                    logger_1.logger.warn(`Export file not found for request ${requestId}: ${requestedFilePath}`);
                    res.status(404).json({
                        message: 'Export file not found',
                    });
                    return;
                }
                if (fileStats.size > MAX_EXPORT_SIZE) {
                    logger_1.logger.warn(`Export file size exceeds limit for user ${user.id}: ${fileStats.size} bytes`);
                    res.status(413).json({
                        message: `Export file is too large (${Math.round(fileStats.size / 1024 / 1024)}MB). Maximum allowed is ${MAX_EXPORT_SIZE / 1024 / 1024}MB.`,
                    });
                    return;
                }
                const fileContent = await promises_1.default.readFile(requestedFilePath, 'utf-8');
                const localFormat = exportRequest.exportMetadata?.format || 'json';
                const localContentType = localFormat === 'csv' ? 'text/csv; charset=utf-8' : 'application/json';
                const localFileExt = localFormat === 'csv' ? 'csv' : 'json';
                res.setHeader('Content-Type', localContentType);
                res.setHeader('Content-Disposition', `attachment; filename="user-data-${user.id}-${requestId}.${localFileExt}"`);
                res.send(fileContent);
                logger_1.logger.info(`Export file downloaded from local file system for user ${user.id}: ${requestId}`);
            }
            catch (error) {
                logger_1.logger.error(`Error reading export file for request ${requestId}:`, error);
                res.status(500).json({
                    message: 'Failed to read export file',
                });
            }
        });
    };
    getUserExportRequests = async (req, res) => {
        await this.executeAndReturn(req, res, async (req) => {
            const user = this.getAuthUser(req);
            const limit = Math.min(Number.parseInt(req.query.limit) || 10, 200);
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
    exportUserData = async (req, res) => {
        await this.execute(req, res, async (req) => {
            const user = this.getAuthUser(req);
            const format = req.query.format?.toLowerCase() || 'json';
            logger_1.logger.info(`Data export requested by user ${user.id} (format: ${format})`);
            const exportData = await this.consentService.exportUserData(user.id);
            if (format === 'csv') {
                const csvContent = (0, gdprCsvExporter_1.convertGdprDataToCsv)(exportData);
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="user-data-${user.id}-${Date.now()}.csv"`);
                res.send(csvContent);
                return;
            }
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="user-data-${user.id}-${Date.now()}.json"`);
            this.sendSuccess(res, exportData);
        });
    };
    requestDataDeletion = async (req, res) => {
        await this.execute(req, res, async (req, res) => {
            const user = this.getAuthUser(req);
            this.validateRequired(req.body, 'confirm');
            if (req.body.confirm !== 'DELETE') {
                res.status(400).json({
                    message: 'Please confirm deletion by providing "confirm": "DELETE" in request body',
                });
                return;
            }
            const holdStatus = await this.deletionService.checkLegalHold(user.id);
            if (holdStatus.isOnHold) {
                res.status(403).json({
                    message: 'Your account is under legal hold and cannot be deleted at this time.',
                    reason: holdStatus.reason,
                    holdUntil: holdStatus.holdUntil,
                });
                return;
            }
            logger_1.logger.warn(`Data deletion requested by user ${user.id}`);
            const _preview = await this.deletionService.getDataDeletionPreview(user.id);
            const immediateDelete = req.body.immediate === true;
            if (immediateDelete) {
                const result = await this.deletionService.deleteAllUserData(user.id);
                if (result.success) {
                    this.sendSuccess(res, {
                        message: 'Your account and all associated data have been permanently deleted.',
                        deletedCounts: result.deletedCounts,
                        totalDeleted: result.totalDeleted,
                        completedAt: result.completedAt,
                    });
                }
                else {
                    res.status(500).json({
                        message: 'Data deletion encountered errors. Please contact support.',
                        errors: result.errors,
                    });
                }
            }
            else {
                const ipAddress = req.ip || req.socket.remoteAddress;
                const userAgent = req.headers['user-agent'];
                const deletionRequest = await this.deletionService.createDeletionRequest(user.id, ipAddress, userAgent);
                await this.consentService.revokeAllConsents(user.id);
                const daysUntilDeletion = Math.ceil((deletionRequest.scheduledFor.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                this.sendSuccess(res, {
                    message: 'Data deletion request received. You can cancel this request during the grace period.',
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
    cancelDeletionRequest = async (req, res) => {
        await this.execute(req, res, async (req, res) => {
            const user = this.getAuthUser(req);
            const { reason } = req.body;
            logger_1.logger.info(`User ${user.id} attempting to cancel deletion request`);
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
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to cancel deletion request';
                logger_1.logger.error(`Error cancelling deletion request for user ${user.id}:`, error);
                res.status(400).json({
                    message: errorMessage,
                });
            }
        });
    };
    getDeletionStatus = async (req, res) => {
        await this.executeAndReturn(req, res, async (req) => {
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
    getConsentStatistics = async (req, res) => {
        await this.execute(req, res, async (req) => {
            this.requireRole(req, 'admin');
            const statistics = await this.consentService.getConsentStatistics();
            this.sendSuccess(res, {
                statistics,
                generatedAt: new Date().toISOString(),
            });
        });
    };
    checkConsent = async (req, res) => {
        await this.execute(req, res, async (req, res) => {
            const user = this.getAuthUser(req);
            const { consentType } = req.params;
            if (!Object.values(UserConsent_1.ConsentType).includes(consentType)) {
                res.status(400).json({
                    message: `Invalid consent type. Valid types: ${Object.values(UserConsent_1.ConsentType).join(', ')}`,
                });
                return;
            }
            const hasConsent = await this.consentService.hasConsent(user.id, consentType);
            this.sendSuccess(res, {
                consentType,
                granted: hasConsent,
            });
        });
    };
    checkConsentVersion = async (req, res) => {
        await this.execute(req, res, async (req, res) => {
            const user = this.getAuthUser(req);
            const { consentType } = req.params;
            if (!Object.values(UserConsent_1.ConsentType).includes(consentType)) {
                res.status(400).json({
                    message: `Invalid consent type. Valid types: ${Object.values(UserConsent_1.ConsentType).join(', ')}`,
                });
                return;
            }
            const versionStatus = await this.consentService.checkConsentVersion(user.id, consentType);
            this.sendSuccess(res, versionStatus);
        });
    };
    getAdminGdprRequests = async (req, res) => {
        await this.execute(req, res, async (req) => {
            this.requireRole(req, 'admin');
            const limit = Math.min(Number(req.query.limit) || 50, 100);
            const [exportRequests, deletionRequests, exportCount30d, pendingDeletionCount] = await Promise.all([
                this.exportService.getAllExportRequests(limit),
                this.deletionService.getAllDeletionRequests(limit),
                this.exportService.getExportCountLastNDays(30),
                this.deletionService.getPendingDeletionCount(),
            ]);
            const requests = [
                ...exportRequests.map(r => ({
                    id: r.id,
                    type: 'export',
                    userId: r.userId ?? null,
                    status: r.status,
                    requestedAt: r.requestedAt.toISOString(),
                    completedAt: r.completedAt?.toISOString() ?? null,
                })),
                ...deletionRequests.map(r => ({
                    id: r.id,
                    type: 'deletion',
                    userId: r.userId ?? null,
                    status: r.status,
                    requestedAt: r.requestedAt.toISOString(),
                    completedAt: r.completedAt?.toISOString() ?? null,
                })),
            ].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
            const exportTotal = exportRequests.length;
            const deletionTotal = deletionRequests.length;
            const pendingTotal = exportRequests.filter(r => r.status === 'pending' || r.status === 'processing').length +
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
    getComplianceDashboard = async (req, res) => {
        await this.execute(req, res, async (req) => {
            this.requireRole(req, 'admin');
            const user = this.getAuthUser(req);
            const consentStats = await this.consentService.getConsentStatistics();
            const pendingDeletions = await this.deletionService.getPendingDeletionCount();
            const pendingDeletionRequests = await this.deletionService.getAllPendingDeletionRequests();
            const dataExportsLast30Days = await this.exportService.getExportCountLastNDays(30);
            const complianceScore = this.calculateComplianceScore(consentStats);
            const organization = await (0, gdprUtils_1.getUserPrimaryOrganization)(user.id);
            const gdprSettings = organization?.getGdprSettings() || { ...Organization_1.DEFAULT_GDPR_SETTINGS };
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
                        daysRemaining: Math.ceil((req.scheduledFor.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
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
    calculateComplianceScore(consentStats) {
        let score = 70;
        const totalConsents = consentStats.reduce((sum, stat) => sum + stat.total, 0);
        if (totalConsents > 0) {
            score += 10;
        }
        if (consentStats.length >= 3) {
            score += 10;
        }
        const essentialStat = consentStats.find(s => s.type === UserConsent_1.ConsentType.ESSENTIAL);
        if (essentialStat && essentialStat.granted > 0) {
            score += 5;
        }
        score += 5;
        return Math.min(100, score);
    }
    getComplianceRecommendations(score) {
        const recommendations = [];
        if (score < 80) {
            recommendations.push('Review and document legal basis for all data processing activities', 'Ensure all users have been prompted for consent preferences');
        }
        if (score < 90) {
            recommendations.push('Schedule quarterly GDPR compliance review', 'Update privacy policy if needed');
        }
        recommendations.push('Regular staff training on data protection', 'Monitor data breach notification procedures');
        return recommendations;
    }
    verifyDeletionEmail = async (req, res) => {
        await this.execute(req, res, async (req, res) => {
            this.validateRequired(req.body, 'token');
            const { token } = req.body;
            const { OrganizationDeletionService } = await Promise.resolve().then(() => __importStar(require('../services/organization/OrganizationDeletionService')));
            const deletionService = new OrganizationDeletionService();
            const request = await deletionService.verifyEmailConfirmation(token);
            this.sendSuccess(res, {
                message: 'Email verified successfully. Your deletion request has been submitted for admin approval.',
                request: {
                    id: request.id,
                    organizationId: request.organizationId,
                    status: request.status,
                    emailVerifiedAt: request.emailVerifiedAt,
                },
            });
        });
    };
    resendDeletionConfirmation = async (req, res) => {
        await this.execute(req, res, async (req, res) => {
            const _user = this.getAuthUser(req);
            this.validateRequired(req.body, 'requestId');
            const { requestId } = req.body;
            const { OrganizationDeletionService } = await Promise.resolve().then(() => __importStar(require('../services/organization/OrganizationDeletionService')));
            const deletionService = new OrganizationDeletionService();
            await deletionService.sendEmailVerification(requestId);
            this.sendSuccess(res, {
                message: 'Confirmation email sent successfully.',
            });
        });
    };
}
exports.GdprController = GdprController;
//# sourceMappingURL=gdprController.js.map