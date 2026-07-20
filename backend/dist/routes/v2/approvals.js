"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const approvalController_1 = require("../../controllers/v2/approvalController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const approvalSchemas_1 = require("../../schemas/approvalSchemas");
const router = (0, express_1.Router)();
exports.router = router;
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
let controller;
function getController() {
    if (!controller) {
        controller = new approvalController_1.ApprovalController();
    }
    return controller;
}
router.get('/pending', ...orgAuth, (req, res) => getController().getPending(req, res));
router.get('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(approvalSchemas_1.approvalSchemas.query, 'query'), (req, res) => getController().list(req, res));
router.post('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(approvalSchemas_1.approvalSchemas.create, 'body'), (req, res) => getController().create(req, res));
router.get('/:approvalId', ...orgAuth, (0, schemaValidation_1.validateSchema)(approvalSchemas_1.approvalSchemas.param, 'params'), (req, res) => getController().getById(req, res));
router.post('/:approvalId/approve', ...orgAuth, (0, schemaValidation_1.validateSchema)(approvalSchemas_1.approvalSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(approvalSchemas_1.approvalSchemas.approve, 'body'), (req, res) => getController().approve(req, res));
router.post('/:approvalId/reject', ...orgAuth, (0, schemaValidation_1.validateSchema)(approvalSchemas_1.approvalSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(approvalSchemas_1.approvalSchemas.reject, 'body'), (req, res) => getController().reject(req, res));
router.post('/:approvalId/delegate', ...orgAuth, (0, schemaValidation_1.validateSchema)(approvalSchemas_1.approvalSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(approvalSchemas_1.approvalSchemas.delegate, 'body'), (req, res) => getController().delegate(req, res));
router.get('/:approvalId/history', ...orgAuth, (0, schemaValidation_1.validateSchema)(approvalSchemas_1.approvalSchemas.param, 'params'), (req, res) => getController().getHistory(req, res));
//# sourceMappingURL=approvals.js.map