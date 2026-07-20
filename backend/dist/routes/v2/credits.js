"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const treasuryController_1 = require("../../controllers/treasuryController");
const auth_1 = require("../../middleware/auth");
const permissionMiddleware_1 = require("../../middleware/permissionMiddleware");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const OrganizationPermission_1 = require("../../models/OrganizationPermission");
const treasurySchemas_1 = require("../../schemas/treasurySchemas");
const router = (0, express_1.Router)();
exports.router = router;
let treasuryController;
const getController = () => {
    if (!treasuryController) {
        treasuryController = new treasuryController_1.TreasuryController();
    }
    return treasuryController;
};
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.get('/balance', ...orgAuth, (0, permissionMiddleware_1.requirePermission)(OrganizationPermission_1.ResourceType.TREASURY, 'read'), (req, res) => getController().getBalance(req, res));
router.get('/transactions', ...orgAuth, (0, permissionMiddleware_1.requirePermission)(OrganizationPermission_1.ResourceType.TREASURY, 'read'), (0, schemaValidation_1.validateSchema)(treasurySchemas_1.treasurySchemas.transactionQuery, 'query'), (req, res) => getController().getTransactions(req, res));
router.get('/statistics', ...orgAuth, (0, permissionMiddleware_1.requirePermission)(OrganizationPermission_1.ResourceType.TREASURY, 'read'), (0, schemaValidation_1.validateSchema)(treasurySchemas_1.treasurySchemas.statisticsQuery, 'query'), (req, res) => getController().getStatistics(req, res));
router.get('/leaderboard', ...orgAuth, (0, permissionMiddleware_1.requirePermission)(OrganizationPermission_1.ResourceType.TREASURY, 'read'), (0, schemaValidation_1.validateSchema)(treasurySchemas_1.treasurySchemas.leaderboardQuery, 'query'), (req, res) => getController().getLeaderboard(req, res));
router.post('/earn', ...orgAuth, (0, permissionMiddleware_1.requirePermission)(OrganizationPermission_1.ResourceType.TREASURY, 'manage'), (0, schemaValidation_1.validateSchema)(treasurySchemas_1.treasurySchemas.earn, 'body'), (req, res) => getController().earnCredits(req, res));
router.post('/spend', ...orgAuth, (0, permissionMiddleware_1.requirePermission)(OrganizationPermission_1.ResourceType.TREASURY, 'manage'), (0, schemaValidation_1.validateSchema)(treasurySchemas_1.treasurySchemas.spend, 'body'), (req, res) => getController().spendCredits(req, res));
router.post('/transfer', ...orgAuth, (0, permissionMiddleware_1.requirePermission)(OrganizationPermission_1.ResourceType.TREASURY, 'manage'), (0, schemaValidation_1.validateSchema)(treasurySchemas_1.treasurySchemas.transfer, 'body'), (req, res) => getController().transferCredits(req, res));
router.get('/dues', ...orgAuth, (0, permissionMiddleware_1.requirePermission)(OrganizationPermission_1.ResourceType.TREASURY, 'read'), (0, schemaValidation_1.validateSchema)(treasurySchemas_1.treasurySchemas.duesQuery, 'query'), (req, res) => getController().listDues(req, res));
router.post('/dues', ...orgAuth, (0, permissionMiddleware_1.requirePermission)(OrganizationPermission_1.ResourceType.TREASURY, 'manage'), (0, schemaValidation_1.validateSchema)(treasurySchemas_1.treasurySchemas.createDues, 'body'), (req, res) => getController().createDues(req, res));
router.put('/dues/:duesId', ...orgAuth, (0, permissionMiddleware_1.requirePermission)(OrganizationPermission_1.ResourceType.TREASURY, 'manage'), (0, schemaValidation_1.validateSchema)(treasurySchemas_1.treasurySchemas.duesParam, 'params'), (0, schemaValidation_1.validateSchema)(treasurySchemas_1.treasurySchemas.updateDues, 'body'), (req, res) => getController().updateDues(req, res));
router.delete('/dues/:duesId', ...orgAuth, (0, permissionMiddleware_1.requirePermission)(OrganizationPermission_1.ResourceType.TREASURY, 'manage'), (0, schemaValidation_1.validateSchema)(treasurySchemas_1.treasurySchemas.duesParam, 'params'), (req, res) => getController().deleteDues(req, res));
router.get('/commissary', ...orgAuth, (0, permissionMiddleware_1.requirePermission)(OrganizationPermission_1.ResourceType.TREASURY, 'read'), (0, schemaValidation_1.validateSchema)(treasurySchemas_1.treasurySchemas.commissaryQuery, 'query'), (req, res) => getController().listCommissaryItems(req, res));
router.get('/commissary/purchases', ...orgAuth, (0, permissionMiddleware_1.requirePermission)(OrganizationPermission_1.ResourceType.TREASURY, 'read'), (0, schemaValidation_1.validateSchema)(treasurySchemas_1.treasurySchemas.purchaseQuery, 'query'), (req, res) => getController().getPurchaseHistory(req, res));
router.post('/commissary', ...orgAuth, (0, permissionMiddleware_1.requirePermission)(OrganizationPermission_1.ResourceType.COMMISSARY, 'manage'), (0, schemaValidation_1.validateSchema)(treasurySchemas_1.treasurySchemas.createCommissaryItem, 'body'), (req, res) => getController().createCommissaryItem(req, res));
router.put('/commissary/:itemId', ...orgAuth, (0, permissionMiddleware_1.requirePermission)(OrganizationPermission_1.ResourceType.COMMISSARY, 'manage'), (0, schemaValidation_1.validateSchema)(treasurySchemas_1.treasurySchemas.itemParam, 'params'), (0, schemaValidation_1.validateSchema)(treasurySchemas_1.treasurySchemas.updateCommissaryItem, 'body'), (req, res) => getController().updateCommissaryItem(req, res));
router.delete('/commissary/:itemId', ...orgAuth, (0, permissionMiddleware_1.requirePermission)(OrganizationPermission_1.ResourceType.COMMISSARY, 'manage'), (0, schemaValidation_1.validateSchema)(treasurySchemas_1.treasurySchemas.itemParam, 'params'), (req, res) => getController().deleteCommissaryItem(req, res));
router.post('/commissary/:itemId/purchase', ...orgAuth, (0, permissionMiddleware_1.requirePermission)(OrganizationPermission_1.ResourceType.COMMISSARY, 'purchase'), (0, schemaValidation_1.validateSchema)(treasurySchemas_1.treasurySchemas.itemParam, 'params'), (0, schemaValidation_1.validateSchema)(treasurySchemas_1.treasurySchemas.purchase, 'body'), (req, res) => getController().purchaseItem(req, res));
//# sourceMappingURL=credits.js.map