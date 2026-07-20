"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplianceController = void 0;
const LicenseExportService_1 = require("../services/compliance/LicenseExportService");
const DataRetentionService_1 = require("../services/data/DataRetentionService");
const logger_1 = require("../utils/logger");
const queryUtils_1 = require("../utils/queryUtils");
const BaseController_1 = require("./BaseController");
class ComplianceController extends BaseController_1.BaseController {
    licenseExportService;
    constructor() {
        super();
        this.licenseExportService = new LicenseExportService_1.LicenseExportService();
    }
    exportLicenses = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const format = req.query.format || 'json';
            const includeDevDependencies = (0, queryUtils_1.parseBooleanQuery)(req.query.includeDevDependencies);
            const filter = req.query.filter || 'all';
            const result = await this.licenseExportService.exportLicenses({
                includeDevDependencies,
                filter,
            });
            logger_1.logger.info('License export requested', {
                userId: user.id,
                format,
                filter,
                totalPackages: result.totalPackages,
            });
            if (format === 'csv') {
                const csv = this.licenseExportService.formatAsCsv(result);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename=licenses.csv');
                res.send(csv);
            }
            else if (format === 'text') {
                const text = this.licenseExportService.formatAsText(result);
                res.setHeader('Content-Type', 'text/plain');
                res.send(text);
            }
            else {
                this.sendSuccess(res, result);
            }
        });
    };
    getRetentionConfig = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            this.getAuthUser(req);
            const retentionService = (0, DataRetentionService_1.getDataRetentionService)();
            return retentionService.getRetentionConfig();
        });
    };
    executeRetention = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { dryRun } = req.body;
            logger_1.logger.info('Manual retention cleanup triggered', {
                userId: user.id,
                dryRun: dryRun || false,
            });
            const retentionService = (0, DataRetentionService_1.getDataRetentionService)();
            const results = await retentionService.runCleanup();
            this.sendSuccess(res, {
                message: 'Data retention cleanup completed',
                dryRun: dryRun || false,
                results,
            });
        });
    };
}
exports.ComplianceController = ComplianceController;
//# sourceMappingURL=complianceController.js.map