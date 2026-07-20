"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const lootController_1 = require("../../controllers/lootController");
const auth_1 = require("../../middleware/auth");
const fileValidation_1 = require("../../middleware/fileValidation");
const permissionMiddleware_1 = require("../../middleware/permissionMiddleware");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const OrganizationPermission_1 = require("../../models/OrganizationPermission");
const lootSchemas_1 = require("../../schemas/lootSchemas");
const router = (0, express_1.Router)();
exports.router = router;
let lootController;
const getController = () => {
    if (!lootController) {
        lootController = new lootController_1.LootController();
    }
    return lootController;
};
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
const manage = (0, permissionMiddleware_1.requirePermission)(OrganizationPermission_1.ResourceType.LOOT, 'manage');
router.get('/pools', ...orgAuth, (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.listQuery, 'query'), (req, res) => getController().listPools(req, res));
router.post('/pools', ...orgAuth, manage, (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.createPool, 'body'), (req, res) => getController().createPool(req, res));
router.get('/pools/:poolId', ...orgAuth, (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.poolParam, 'params'), (req, res) => getController().getPool(req, res));
router.get('/pools/:poolId/participants', ...orgAuth, (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.poolParam, 'params'), (req, res) => getController().getEligibleParticipants(req, res));
router.patch('/pools/:poolId', ...orgAuth, (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.poolParam, 'params'), (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.updatePool, 'body'), (req, res) => getController().updatePool(req, res));
router.post('/pools/:poolId/lock', ...orgAuth, (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.poolParam, 'params'), (req, res) => getController().lockPool(req, res));
router.post('/pools/:poolId/cancel', ...orgAuth, (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.poolParam, 'params'), (req, res) => getController().cancelPool(req, res));
router.post('/pools/:poolId/distribute', ...orgAuth, (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.poolParam, 'params'), (req, res) => getController().distributePool(req, res));
router.post('/pools/:poolId/retry-distribution', ...orgAuth, (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.poolParam, 'params'), (req, res) => getController().retryDistribution(req, res));
router.post('/pools/:poolId/items', ...orgAuth, (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.poolParam, 'params'), (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.addItem, 'body'), (req, res) => getController().addItem(req, res));
router.post('/pools/:poolId/items/bulk', ...orgAuth, (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.poolParam, 'params'), (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.addItemsBulk, 'body'), (req, res) => getController().addItemsBulk(req, res));
router.patch('/pools/:poolId/items/:itemId', ...orgAuth, (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.itemParam, 'params'), (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.updateItem, 'body'), (req, res) => getController().updateItem(req, res));
router.delete('/pools/:poolId/items/:itemId', ...orgAuth, (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.itemParam, 'params'), (req, res) => getController().removeItem(req, res));
router.post('/pools/:poolId/items/:itemId/assign', ...orgAuth, (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.itemParam, 'params'), (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.assignItem, 'body'), (req, res) => getController().assignItem(req, res));
router.post('/pools/:poolId/items/:itemId/claim', ...orgAuth, (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.itemParam, 'params'), (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.claim, 'body'), (req, res) => getController().claimItem(req, res));
router.delete('/pools/:poolId/items/:itemId/claim', ...orgAuth, (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.itemParam, 'params'), (req, res) => getController().withdrawClaim(req, res));
router.post('/pools/:poolId/ocr/scan', ...orgAuth, (0, schemaValidation_1.validateSchema)(lootSchemas_1.lootSchemas.poolParam, 'params'), fileValidation_1.imageUploadConfig.single('image'), fileValidation_1.handleFileUploadError, (req, res) => getController().scanImageForPool(req, res));
router.post('/ocr/scan', ...orgAuth, manage, fileValidation_1.imageUploadConfig.single('image'), fileValidation_1.handleFileUploadError, (req, res) => getController().scanImage(req, res));
//# sourceMappingURL=loot.js.map