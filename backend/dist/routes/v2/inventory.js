"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const inventoryController_1 = require("../../controllers/v2/inventoryController");
const auth_1 = require("../../middleware/auth");
const tenantContext_1 = require("../../middleware/tenantContext");
const router = (0, express_1.Router)();
exports.router = router;
const controller = new inventoryController_1.InventoryControllerV2();
const injectOrgFromContext = (req, res, next) => {
    const orgId = req.tenantContext?.organizationId;
    if (!orgId) {
        res.status(400).json({
            error: 'No active organization selected',
            message: 'Please select an organization to continue',
            requiresOrgSelection: true,
        });
        return;
    }
    req.params.orgId = orgId;
    next();
};
const userInventoryAuth = [
    auth_1.authenticate,
    tenantContext_1.tenantContextMiddleware,
    tenantContext_1.requireTenantContext,
    injectOrgFromContext,
];
router.get('/inventory', ...userInventoryAuth, controller.getInventory.bind(controller));
router.get('/inventory/statistics', ...userInventoryAuth, controller.getInventoryStatistics.bind(controller));
router.get('/inventory/:id', ...userInventoryAuth, controller.getInventoryItem.bind(controller));
router.post('/inventory', ...userInventoryAuth, controller.createInventoryItem.bind(controller));
router.patch('/inventory/:id', ...userInventoryAuth, controller.updateInventoryItem.bind(controller));
router.delete('/inventory/:id', ...userInventoryAuth, controller.deleteInventoryItem.bind(controller));
router.get('/inventory/market-prices/:itemName', auth_1.authenticate, controller.getMarketPrices.bind(controller));
router.get('/organizations/:orgId/inventory', auth_1.authenticate, controller.getInventory.bind(controller));
router.get('/organizations/:orgId/inventory/statistics', auth_1.authenticate, controller.getInventoryStatistics.bind(controller));
router.get('/organizations/:orgId/inventory/:id', auth_1.authenticate, controller.getInventoryItem.bind(controller));
router.post('/organizations/:orgId/inventory', auth_1.authenticate, controller.createInventoryItem.bind(controller));
router.patch('/organizations/:orgId/inventory/:id', auth_1.authenticate, controller.updateInventoryItem.bind(controller));
router.delete('/organizations/:orgId/inventory/:id', auth_1.authenticate, controller.deleteInventoryItem.bind(controller));
router.get('/organizations/:orgId/cargo-manifests', auth_1.authenticate, controller.getCargoManifests.bind(controller));
router.get('/cargo-manifests/:id', ...userInventoryAuth, controller.getCargoManifest.bind(controller));
router.post('/organizations/:orgId/cargo-manifests', auth_1.authenticate, controller.createCargoManifest.bind(controller));
router.put('/cargo-manifests/:id/status', ...userInventoryAuth, controller.updateCargoManifestStatus.bind(controller));
router.post('/cargo-manifests/:id/cargo', ...userInventoryAuth, controller.addCargoItem.bind(controller));
router.put('/cargo-manifests/:id/sharing', ...userInventoryAuth, controller.updateCargoManifestSharing.bind(controller));
//# sourceMappingURL=inventory.js.map