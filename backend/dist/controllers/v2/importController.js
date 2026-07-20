"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportController = void 0;
const GenericCsvPreviewService_1 = require("../../services/user/GenericCsvPreviewService");
const SCStatsImportService_1 = require("../../services/user/SCStatsImportService");
const apiErrors_1 = require("../../utils/apiErrors");
const BaseController_1 = require("../BaseController");
class ImportController extends BaseController_1.BaseController {
    importService;
    genericCsvPreviewService;
    constructor() {
        super();
        this.importService = new SCStatsImportService_1.SCStatsImportService();
        this.genericCsvPreviewService = new GenericCsvPreviewService_1.GenericCsvPreviewService();
    }
    create = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { source, jsonData, consentGranted } = req.body;
            if (!consentGranted) {
                res.status(400).json({
                    success: false,
                    error: 'Consent is required for data import (GDPR Article 6)',
                });
                return;
            }
            if (source === 'scstats_csv') {
                res.status(400).json({
                    success: false,
                    error: 'SCStats CSV import is handled by /api/v2/scstats/users/:userId/csv-import (multipart upload).',
                });
                return;
            }
            if (source === 'generic_csv') {
                res.status(400).json({
                    success: false,
                    error: 'Generic CSV import persistence is not enabled yet. Use /api/v2/import/validate with source=generic_csv for schema preview.',
                });
                return;
            }
            if (typeof jsonData !== 'string' || jsonData.trim().length < 2) {
                throw new apiErrors_1.ValidationError('jsonData is required for source scstats_json');
            }
            const result = await this.importService.importData(user.id, jsonData, consentGranted);
            res.status(201).json({
                success: true,
                data: result,
            });
        });
    };
    getById = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const data = await this.importService.getData(user.id);
            res.json({
                success: true,
                data,
            });
        });
    };
    listJobs = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const data = await this.importService.getData(user.id);
            res.json({
                success: true,
                data: data.hasData ? [data] : [],
                pagination: {
                    total: data.hasData ? 1 : 0,
                    count: data.hasData ? 1 : 0,
                    page: 1,
                    pageSize: 20,
                    hasMore: false,
                    totalPages: data.hasData ? 1 : 0,
                },
            });
        });
    };
    cancel = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            await this.importService.deleteData(user.id);
            res.json({
                success: true,
                data: { message: 'Import data deleted successfully' },
            });
        });
    };
    validate = async (req, res) => {
        await this.execute(req, res, async () => {
            const { source, jsonData, csvData } = req.body;
            try {
                if (source === 'generic_csv') {
                    if (typeof csvData !== 'string' || csvData.trim().length < 2) {
                        throw new apiErrors_1.ValidationError('csvData is required for source generic_csv');
                    }
                    const preview = this.genericCsvPreviewService.parsePreview(csvData);
                    res.json({
                        success: true,
                        data: {
                            valid: true,
                            source: 'generic_csv',
                            preview,
                        },
                    });
                    return;
                }
                if (source === 'scstats_csv') {
                    res.json({
                        success: true,
                        data: {
                            valid: true,
                            source: 'scstats_csv',
                            guidance: 'Use /api/v2/scstats/users/:userId/csv-import with playtime, loadoutTop, loadoutDetail, purchases, and ships files.',
                            expectedFiles: ['playtime', 'loadoutTop', 'loadoutDetail', 'purchases', 'ships'],
                        },
                    });
                    return;
                }
                if (typeof jsonData !== 'string' || jsonData.trim().length < 2) {
                    throw new apiErrors_1.ValidationError('jsonData is required for source scstats_json');
                }
                const parsed = this.importService.parseJSON(jsonData);
                res.json({
                    success: true,
                    data: {
                        valid: true,
                        source: 'scstats_json',
                        sections: Object.keys(parsed),
                    },
                });
            }
            catch (err) {
                res.json({
                    success: true,
                    data: {
                        valid: false,
                        error: err instanceof Error ? err.message : 'Invalid data format',
                    },
                });
            }
        });
    };
}
exports.ImportController = ImportController;
//# sourceMappingURL=importController.js.map