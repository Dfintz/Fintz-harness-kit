"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const archiveController_1 = require("../../controllers/v2/archiveController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const archiveSchemas_1 = require("../../schemas/archiveSchemas");
const router = (0, express_1.Router)();
exports.router = router;
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
let controller;
function getController() {
    if (!controller) {
        controller = new archiveController_1.ArchiveController();
    }
    return controller;
}
router.get('/statistics', ...orgAuth, (req, res) => getController().getStatistics(req, res));
router.post('/bulk', ...orgAuth, (0, schemaValidation_1.validateSchema)(archiveSchemas_1.archiveSchemas.bulk, 'body'), (req, res) => getController().bulkArchive(req, res));
router.get('/search', ...orgAuth, (0, schemaValidation_1.validateSchema)(archiveSchemas_1.archiveSchemas.search, 'query'), (req, res) => getController().search(req, res));
router.get('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(archiveSchemas_1.archiveSchemas.query, 'query'), (req, res) => getController().list(req, res));
router.post('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(archiveSchemas_1.archiveSchemas.create, 'body'), (req, res) => getController().archive(req, res));
router.get('/:archiveId', ...orgAuth, (0, schemaValidation_1.validateSchema)(archiveSchemas_1.archiveSchemas.param, 'params'), (req, res) => getController().getById(req, res));
router.post('/:archiveId/restore', ...orgAuth, (0, schemaValidation_1.validateSchema)(archiveSchemas_1.archiveSchemas.param, 'params'), (req, res) => getController().restore(req, res));
router.delete('/:archiveId', ...orgAuth, (0, schemaValidation_1.validateSchema)(archiveSchemas_1.archiveSchemas.param, 'params'), (req, res) => getController().delete(req, res));
//# sourceMappingURL=archives.js.map