"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const workflowController_1 = require("../../controllers/v2/workflowController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const workflowSchemas_1 = require("../../schemas/workflowSchemas");
const router = (0, express_1.Router)();
exports.router = router;
let workflowController;
const getController = () => {
    if (!workflowController) {
        workflowController = new workflowController_1.WorkflowController();
    }
    return workflowController;
};
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.get('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(workflowSchemas_1.workflowSchemas.query, 'query'), (req, res) => getController().list(req, res));
router.post('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(workflowSchemas_1.workflowSchemas.create, 'body'), (req, res) => getController().create(req, res));
router.get('/:workflowId', ...orgAuth, (0, schemaValidation_1.validateSchema)(workflowSchemas_1.workflowSchemas.param, 'params'), (req, res) => getController().getById(req, res));
router.put('/:workflowId', ...orgAuth, (0, schemaValidation_1.validateSchema)(workflowSchemas_1.workflowSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(workflowSchemas_1.workflowSchemas.update, 'body'), (req, res) => getController().update(req, res));
router.delete('/:workflowId', ...orgAuth, (0, schemaValidation_1.validateSchema)(workflowSchemas_1.workflowSchemas.param, 'params'), (req, res) => getController().delete(req, res));
router.post('/:workflowId/execute', ...orgAuth, (0, schemaValidation_1.validateSchema)(workflowSchemas_1.workflowSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(workflowSchemas_1.workflowSchemas.execute, 'body'), (req, res) => getController().execute_(req, res));
router.get('/:workflowId/executions', ...orgAuth, (0, schemaValidation_1.validateSchema)(workflowSchemas_1.workflowSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(workflowSchemas_1.workflowSchemas.executionsQuery, 'query'), (req, res) => getController().getExecutions(req, res));
router.post('/:workflowId/enable', ...orgAuth, (0, schemaValidation_1.validateSchema)(workflowSchemas_1.workflowSchemas.param, 'params'), (req, res) => getController().enable(req, res));
router.post('/:workflowId/disable', ...orgAuth, (0, schemaValidation_1.validateSchema)(workflowSchemas_1.workflowSchemas.param, 'params'), (req, res) => getController().disable(req, res));
//# sourceMappingURL=workflows.js.map