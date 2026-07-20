"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const dashboardController_1 = require("../../controllers/v2/dashboardController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const dashboardSchemas_1 = require("../../schemas/dashboardSchemas");
const router = (0, express_1.Router)();
exports.router = router;
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
let controller;
function getController() {
    if (!controller) {
        controller = new dashboardController_1.DashboardController();
    }
    return controller;
}
router.get('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(dashboardSchemas_1.dashboardSchemas.query, 'query'), (req, res) => getController().list(req, res));
router.post('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(dashboardSchemas_1.dashboardSchemas.create, 'body'), (req, res) => getController().create(req, res));
router.get('/:dashboardId', ...orgAuth, (0, schemaValidation_1.validateSchema)(dashboardSchemas_1.dashboardSchemas.param, 'params'), (req, res) => getController().getById(req, res));
router.put('/:dashboardId', ...orgAuth, (0, schemaValidation_1.validateSchema)(dashboardSchemas_1.dashboardSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(dashboardSchemas_1.dashboardSchemas.update, 'body'), (req, res) => getController().update(req, res));
router.delete('/:dashboardId', ...orgAuth, (0, schemaValidation_1.validateSchema)(dashboardSchemas_1.dashboardSchemas.param, 'params'), (req, res) => getController().delete(req, res));
router.post('/:dashboardId/widgets', ...orgAuth, (0, schemaValidation_1.validateSchema)(dashboardSchemas_1.dashboardSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(dashboardSchemas_1.dashboardSchemas.addWidget, 'body'), (req, res) => getController().addWidget(req, res));
router.put('/:dashboardId/widgets/:widgetId', ...orgAuth, (0, schemaValidation_1.validateSchema)(dashboardSchemas_1.dashboardSchemas.widgetParam, 'params'), (0, schemaValidation_1.validateSchema)(dashboardSchemas_1.dashboardSchemas.updateWidget, 'body'), (req, res) => getController().updateWidget(req, res));
router.delete('/:dashboardId/widgets/:widgetId', ...orgAuth, (0, schemaValidation_1.validateSchema)(dashboardSchemas_1.dashboardSchemas.widgetParam, 'params'), (req, res) => getController().deleteWidget(req, res));
router.post('/:dashboardId/share', ...orgAuth, (0, schemaValidation_1.validateSchema)(dashboardSchemas_1.dashboardSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(dashboardSchemas_1.dashboardSchemas.share, 'body'), (req, res) => getController().share(req, res));
//# sourceMappingURL=dashboards.js.map