"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const scstatsController_1 = require("../../controllers/scstatsController");
const auth_1 = require("../../middleware/auth");
const tenantContext_1 = require("../../middleware/tenantContext");
const jsonUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only JSON files are allowed'));
        }
    },
});
const csvUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'text/csv' ||
            file.mimetype === 'application/vnd.ms-excel' ||
            file.originalname.endsWith('.csv')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only CSV files are allowed'));
        }
    },
});
const logUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'text/plain' ||
            file.mimetype === 'application/octet-stream' ||
            file.originalname.endsWith('.log')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only .log files are allowed'));
        }
    },
});
const csvFields = csvUpload.fields([
    { name: 'playtime', maxCount: 1 },
    { name: 'loadoutTop', maxCount: 1 },
    { name: 'loadoutDetail', maxCount: 1 },
    { name: 'purchases', maxCount: 1 },
    { name: 'ships', maxCount: 1 },
]);
const router = (0, express_1.Router)();
exports.router = router;
router.post('/users/:userId/import', auth_1.authenticate, jsonUpload.single('file'), scstatsController_1.scstatsController.importSCStats.bind(scstatsController_1.scstatsController));
router.post('/users/:userId/csv-import', auth_1.authenticate, csvFields, scstatsController_1.scstatsController.importCsvData.bind(scstatsController_1.scstatsController));
router.post('/users/:userId/log-import', auth_1.authenticate, logUpload.array('logs', 30), scstatsController_1.scstatsController.importLogData.bind(scstatsController_1.scstatsController));
router.get('/users/:userId/csv', auth_1.authenticate, scstatsController_1.scstatsController.getCsvData.bind(scstatsController_1.scstatsController));
router.delete('/users/:userId/csv', auth_1.authenticate, scstatsController_1.scstatsController.deleteCsvData.bind(scstatsController_1.scstatsController));
router.get('/users/:userId', auth_1.authenticate, scstatsController_1.scstatsController.getSCStats.bind(scstatsController_1.scstatsController));
router.delete('/users/:userId', auth_1.authenticate, scstatsController_1.scstatsController.deleteSCStats.bind(scstatsController_1.scstatsController));
router.get('/organizations/:organizationId/analytics', auth_1.authenticate, tenantContext_1.tenantContextMiddleware, scstatsController_1.scstatsController.getOrgAnalytics.bind(scstatsController_1.scstatsController));
router.get('/organizations/:organizationId/analytics/public', scstatsController_1.scstatsController.getPublicOrgAnalytics.bind(scstatsController_1.scstatsController));
//# sourceMappingURL=scstats.js.map