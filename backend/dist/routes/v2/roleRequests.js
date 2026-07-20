"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const roleRequestController_1 = require("../../controllers/v2/roleRequestController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const roleRequestSchemas_1 = require("../../schemas/roleRequestSchemas");
const router = (0, express_1.Router)();
exports.router = router;
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
let controller;
function getController() {
    if (!controller) {
        controller = new roleRequestController_1.RoleRequestController();
    }
    return controller;
}
router.get('/pending', ...orgAuth, (req, res) => getController().listPending(req, res));
router.post('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(roleRequestSchemas_1.roleRequestSchemas.create, 'body'), (req, res) => getController().create(req, res));
router.post('/:approvalId/approve', ...orgAuth, (0, schemaValidation_1.validateSchema)(roleRequestSchemas_1.roleRequestSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(roleRequestSchemas_1.roleRequestSchemas.approve, 'body'), (req, res) => getController().approve(req, res));
router.post('/:approvalId/reject', ...orgAuth, (0, schemaValidation_1.validateSchema)(roleRequestSchemas_1.roleRequestSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(roleRequestSchemas_1.roleRequestSchemas.reject, 'body'), (req, res) => getController().reject(req, res));
//# sourceMappingURL=roleRequests.js.map