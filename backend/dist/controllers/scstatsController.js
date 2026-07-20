"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scstatsController = void 0;
const SCStatsOrgAnalyticsService_1 = require("../services/analytics/SCStatsOrgAnalyticsService");
const PublicOrgDirectoryService_1 = require("../services/organization/PublicOrgDirectoryService");
const SCStatsCsvImportService_1 = require("../services/user/SCStatsCsvImportService");
const SCStatsImportService_1 = require("../services/user/SCStatsImportService");
const SCStatsLogImportService_1 = require("../services/user/SCStatsLogImportService");
const apiErrors_1 = require("../utils/apiErrors");
const logger_1 = require("../utils/logger");
const BaseController_1 = require("./BaseController");
class SCStatsController extends BaseController_1.BaseController {
    importService;
    csvImportService;
    logImportService;
    orgAnalyticsService;
    directoryService;
    constructor() {
        super();
        this.importService = new SCStatsImportService_1.SCStatsImportService();
        this.csvImportService = new SCStatsCsvImportService_1.SCStatsCsvImportService();
        this.logImportService = new SCStatsLogImportService_1.SCStatsLogImportService();
        this.orgAnalyticsService = new SCStatsOrgAnalyticsService_1.SCStatsOrgAnalyticsService();
        this.directoryService = new PublicOrgDirectoryService_1.PublicOrgDirectoryService();
    }
    async importSCStats(req, res) {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { userId } = req.params;
            if (user.id !== userId) {
                throw new apiErrors_1.UnauthorizedError('Cannot import SCStats data for another user');
            }
            const file = req.file;
            const body = req.body;
            const consent = body.consent === 'true' || body.consent === true;
            if (!file) {
                throw new apiErrors_1.ValidationError('JSON file is required');
            }
            if (!consent) {
                throw new apiErrors_1.ValidationError('Consent is required to import SCStats data');
            }
            const jsonData = file.buffer.toString('utf-8');
            if (jsonData.length > 5 * 1024 * 1024) {
                throw new apiErrors_1.ValidationError('JSON content exceeds maximum allowed size (5MB)');
            }
            const trimmed = jsonData.trimStart();
            if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
                throw new apiErrors_1.ValidationError('File does not contain valid JSON');
            }
            const preferences = await this.importService.importData(userId, jsonData, consent);
            logger_1.logger.info('SCStats data imported via API', { userId });
            res.status(200).json({
                success: true,
                data: {
                    message: 'SCStats data imported successfully',
                    imported: {
                        totalHours: preferences.scstatsTotalHours,
                        kdRatio: preferences.scstatsKdRatio,
                        missionsCompleted: preferences.scstatsMissionsCompleted,
                        favoriteVehicle: preferences.scstatsFavoriteVehicle,
                    },
                    lastImport: preferences.scstatsLastImport,
                },
            });
        });
    }
    async getSCStats(req, res) {
        await this.execute(req, res, async () => {
            this.getAuthUser(req);
            const { userId } = req.params;
            const data = await this.importService.getData(userId);
            res.status(200).json({
                success: true,
                data,
            });
        });
    }
    async deleteSCStats(req, res) {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { userId } = req.params;
            if (user.id !== userId) {
                throw new apiErrors_1.UnauthorizedError('Cannot delete SCStats data for another user');
            }
            await this.importService.deleteData(userId);
            logger_1.logger.info('SCStats data deleted via API', { userId });
            res.status(200).json({
                success: true,
                data: {
                    message: 'SCStats data deleted successfully',
                },
            });
        });
    }
    async getOrgAnalytics(req, res) {
        await this.execute(req, res, async () => {
            const { organizationId } = req.params;
            this.verifyOrganizationMembership(req, organizationId);
            const analytics = await this.orgAnalyticsService.getOrgAnalytics(organizationId);
            res.status(200).json({
                success: true,
                data: analytics,
            });
        });
    }
    async getPublicOrgAnalytics(req, res) {
        await this.execute(req, res, async () => {
            const { organizationId } = req.params;
            const profile = await this.directoryService.getOrCreateProfile(organizationId);
            if (!profile?.isPublic) {
                throw new apiErrors_1.NotFoundError('Organization stats are not publicly available');
            }
            const analytics = await this.orgAnalyticsService.getOrgAnalytics(organizationId);
            const sanitizedAnalytics = {
                ...analytics,
                topPerformers: analytics.topPerformers.map((p, index) => ({
                    ...p,
                    userId: `member-${index + 1}`,
                })),
            };
            res.status(200).json({
                success: true,
                data: sanitizedAnalytics,
            });
        });
    }
    async importCsvData(req, res) {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { userId } = req.params;
            if (user.id !== userId) {
                throw new apiErrors_1.UnauthorizedError('Cannot import SCStats data for another user');
            }
            const body = req.body;
            const consent = body.consent === 'true' || body.consent === true;
            if (!consent) {
                throw new apiErrors_1.ValidationError('Consent is required to import SCStats data');
            }
            const files = req.files;
            if (!files) {
                throw new apiErrors_1.ValidationError('CSV files are required');
            }
            const knownFields = ['playtime', 'loadoutTop', 'loadoutDetail', 'purchases', 'ships'];
            const presentFields = knownFields.filter(f => files[f] && files[f].length > 0);
            if (presentFields.length === 0) {
                throw new apiErrors_1.ValidationError('At least one CSV file is required (playtime, loadoutTop, loadoutDetail, purchases, or ships).');
            }
            const csvContents = {};
            for (const field of presentFields) {
                csvContents[field] = files[field][0].buffer.toString('utf-8');
            }
            for (const [key, content] of Object.entries(csvContents)) {
                if (content.length > 5 * 1024 * 1024) {
                    throw new apiErrors_1.ValidationError(`${key} CSV exceeds maximum allowed size (5MB)`);
                }
            }
            const result = await this.csvImportService.importCsvData(userId, csvContents, consent);
            logger_1.logger.info('SCStats CSV data imported via API', { userId });
            res.status(200).json({
                success: true,
                data: {
                    message: 'SCStats CSV data imported successfully',
                    summary: result.summary,
                    counts: {
                        playtime: result.counts.playtime?.length ?? 0,
                        loadoutTop: result.counts.loadoutTop?.length ?? 0,
                        loadoutDetail: result.counts.loadoutDetail?.length ?? 0,
                        purchases: result.counts.purchases?.length ?? 0,
                        ships: result.counts.ships?.length ?? 0,
                    },
                },
            });
        });
    }
    async importLogData(req, res) {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { userId } = req.params;
            if (user.id !== userId) {
                throw new apiErrors_1.UnauthorizedError('Cannot import SCStats data for another user');
            }
            const body = req.body;
            const consent = body.consent === 'true' || body.consent === true;
            if (!consent) {
                throw new apiErrors_1.ValidationError('Consent is required to import SCStats data');
            }
            const files = req.files ?? [];
            if (files.length === 0) {
                throw new apiErrors_1.ValidationError('At least one .log file is required');
            }
            const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
            if (totalBytes > 50 * 1024 * 1024) {
                throw new apiErrors_1.ValidationError('Combined log upload size exceeds maximum allowed size (50MB)');
            }
            const parsed = this.logImportService.buildCsvImports(files.map(file => ({
                name: file.originalname,
                content: file.buffer.toString('utf-8'),
            })));
            const result = await this.csvImportService.importCsvData(userId, parsed.csvFiles, consent);
            logger_1.logger.info('SCStats log data imported via API', {
                userId,
                filesProcessed: parsed.meta.filesProcessed,
            });
            res.status(200).json({
                success: true,
                data: {
                    message: 'SCStats log data imported successfully',
                    summary: result.summary,
                    counts: {
                        playtime: result.counts.playtime?.length ?? 0,
                        loadoutTop: result.counts.loadoutTop?.length ?? 0,
                        loadoutDetail: result.counts.loadoutDetail?.length ?? 0,
                        purchases: result.counts.purchases?.length ?? 0,
                        ships: result.counts.ships?.length ?? 0,
                    },
                    logMeta: parsed.meta,
                },
            });
        });
    }
    async getCsvData(req, res) {
        await this.execute(req, res, async () => {
            this.getAuthUser(req);
            const { userId } = req.params;
            const data = await this.csvImportService.getData(userId);
            res.status(200).json({
                success: true,
                data,
            });
        });
    }
    async deleteCsvData(req, res) {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { userId } = req.params;
            if (user.id !== userId) {
                throw new apiErrors_1.UnauthorizedError('Cannot delete SCStats data for another user');
            }
            await this.csvImportService.deleteData(userId);
            logger_1.logger.info('SCStats CSV data deleted via API', { userId });
            res.status(200).json({
                success: true,
                data: {
                    message: 'SCStats CSV data deleted successfully',
                },
            });
        });
    }
}
exports.scstatsController = new SCStatsController();
//# sourceMappingURL=scstatsController.js.map