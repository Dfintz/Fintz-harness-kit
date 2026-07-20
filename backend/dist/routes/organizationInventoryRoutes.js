"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setOrganizationInventoryRoutes = setOrganizationInventoryRoutes;
const express_1 = require("express");
const organizationInventoryController_1 = require("../controllers/organizationInventoryController");
const auth_1 = require("../middleware/auth");
const rateLimiting_1 = require("../middleware/rateLimiting");
const schemaValidation_1 = require("../middleware/schemaValidation");
const tenantContext_1 = require("../middleware/tenantContext");
const schemas_1 = require("../schemas");
const organizationInventorySchemas_1 = require("../schemas/organizationInventorySchemas");
const router = (0, express_1.Router)();
let organizationInventoryController;
const getController = () => {
    if (!organizationInventoryController) {
        organizationInventoryController = new organizationInventoryController_1.OrganizationInventoryController();
    }
    return organizationInventoryController;
};
const INVENTORY_CREATE_ROLES = ['founder', 'owner', 'admin', 'member'];
const INVENTORY_MODIFY_ROLES = ['founder', 'owner', 'admin'];
const authStack = [auth_1.authenticateToken, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.get('/:orgId/inventory/statistics', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), rateLimiting_1.generalRateLimiter, (req, res) => getController().getInventoryStatistics(req, res));
router.get('/:orgId/inventory', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(organizationInventorySchemas_1.organizationInventorySchemas.query, 'query'), rateLimiting_1.generalRateLimiter, (req, res) => getController().getInventory(req, res));
router.post('/:orgId/inventory', ...authStack, (0, tenantContext_1.requireOrganizationRole)(INVENTORY_CREATE_ROLES), (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(organizationInventorySchemas_1.organizationInventorySchemas.create, 'body'), rateLimiting_1.generalRateLimiter, (req, res) => getController().createInventoryItem(req, res));
router.get('/:orgId/inventory/:id', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), rateLimiting_1.generalRateLimiter, (req, res) => getController().getInventoryItem(req, res));
router.patch('/:orgId/inventory/:id', ...authStack, (0, tenantContext_1.requireOrganizationRole)(INVENTORY_MODIFY_ROLES), (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(organizationInventorySchemas_1.organizationInventorySchemas.update, 'body'), rateLimiting_1.generalRateLimiter, (req, res) => getController().updateInventoryItem(req, res));
router.delete('/:orgId/inventory/:id', ...authStack, (0, tenantContext_1.requireOrganizationRole)(INVENTORY_MODIFY_ROLES), (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), rateLimiting_1.generalRateLimiter, (req, res) => getController().deleteInventoryItem(req, res));
function setOrganizationInventoryRoutes(app) {
    app.use('/api/organizations', router);
    app.get('/api/inventory', auth_1.authenticateToken, (req, res) => {
        const user = req.user;
        if (!user?.activeOrgId) {
            return res.json({
                inventory: [],
                total: 0,
                message: 'No active organization. Join or create an organization to manage inventory.',
            });
        }
        req.params.orgId = user.activeOrgId;
        return getController().getInventory(req, res);
    });
}
//# sourceMappingURL=organizationInventoryRoutes.js.map