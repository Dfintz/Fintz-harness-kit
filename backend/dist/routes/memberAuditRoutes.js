"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memberAuditRouter = void 0;
exports.setMemberAuditRoutes = setMemberAuditRoutes;
const express_1 = require("express");
const MemberAuditController_1 = require("../controllers/intel/MemberAuditController");
const MemberProfileController_1 = require("../controllers/intel/MemberProfileController");
const OrgWatchlistController_1 = require("../controllers/intel/OrgWatchlistController");
const auth_1 = require("../middleware/auth");
const permissionMiddleware_1 = require("../middleware/permissionMiddleware");
const rateLimiting_1 = require("../middleware/rateLimiting");
const schemaValidation_1 = require("../middleware/schemaValidation");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
exports.memberAuditRouter = router;
let auditCtrl;
const getAuditCtrl = () => {
    if (!auditCtrl) {
        auditCtrl = new MemberAuditController_1.MemberAuditController();
    }
    return auditCtrl;
};
let watchlistCtrl;
const getWatchlistCtrl = () => {
    if (!watchlistCtrl) {
        watchlistCtrl = new OrgWatchlistController_1.OrgWatchlistController();
    }
    return watchlistCtrl;
};
let profileCtrl;
const getProfileCtrl = () => {
    if (!profileCtrl) {
        profileCtrl = new MemberProfileController_1.MemberProfileController();
    }
    return profileCtrl;
};
router.use('/organizations/:orgId/intel', auth_1.authenticateToken);
router.get('/organizations/:orgId/intel/audit/flags', (0, permissionMiddleware_1.requirePermission)('intel', 'audit:view'), (0, schemaValidation_1.validateSchema)(schemas_1.memberAuditSchemas.orgIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.memberAuditSchemas.listFlagsQuery, 'query'), rateLimiting_1.intelOperationsRateLimiter, (req, res) => getAuditCtrl().listFlags(req, res));
router.get('/organizations/:orgId/intel/audit/flags/:flagId', (0, permissionMiddleware_1.requirePermission)('intel', 'audit:view'), (0, schemaValidation_1.validateSchema)(schemas_1.memberAuditSchemas.flagIdParam, 'params'), rateLimiting_1.intelOperationsRateLimiter, (req, res) => getAuditCtrl().getFlagById(req, res));
router.post('/organizations/:orgId/intel/audit/flags', (0, permissionMiddleware_1.requirePermission)('intel', 'audit:create'), (0, schemaValidation_1.validateSchema)(schemas_1.memberAuditSchemas.orgIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.memberAuditSchemas.createManualFlag, 'body'), rateLimiting_1.intelWriteRateLimiter, (req, res) => getAuditCtrl().createManualFlag(req, res));
router.patch('/organizations/:orgId/intel/audit/flags/:flagId/resolve', (0, permissionMiddleware_1.requirePermission)('intel', 'audit:resolve'), (0, schemaValidation_1.validateSchema)(schemas_1.memberAuditSchemas.flagIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.memberAuditSchemas.resolveFlag, 'body'), rateLimiting_1.intelWriteRateLimiter, (req, res) => getAuditCtrl().resolveFlag(req, res));
router.get('/organizations/:orgId/intel/audit/users/:userId/stats', (0, permissionMiddleware_1.requirePermission)('intel', 'audit:view'), (0, schemaValidation_1.validateSchema)(schemas_1.memberAuditSchemas.userIdParam, 'params'), rateLimiting_1.intelOperationsRateLimiter, (req, res) => getAuditCtrl().getUserFlagStats(req, res));
router.get('/organizations/:orgId/intel/watchlist', (0, permissionMiddleware_1.requirePermission)('intel', 'watchlist:view'), (0, schemaValidation_1.validateSchema)(schemas_1.memberAuditSchemas.orgIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.memberAuditSchemas.listWatchlistQuery, 'query'), rateLimiting_1.intelOperationsRateLimiter, (req, res) => getWatchlistCtrl().listEntries(req, res));
router.get('/organizations/:orgId/intel/watchlist/:entryId', (0, permissionMiddleware_1.requirePermission)('intel', 'watchlist:view'), (0, schemaValidation_1.validateSchema)(schemas_1.memberAuditSchemas.entryIdParam, 'params'), rateLimiting_1.intelOperationsRateLimiter, (req, res) => getWatchlistCtrl().getEntryById(req, res));
router.post('/organizations/:orgId/intel/watchlist', (0, permissionMiddleware_1.requirePermission)('intel', 'watchlist:manage'), (0, schemaValidation_1.validateSchema)(schemas_1.memberAuditSchemas.orgIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.memberAuditSchemas.createWatchlistEntry, 'body'), rateLimiting_1.intelWriteRateLimiter, (req, res) => getWatchlistCtrl().createEntry(req, res));
router.patch('/organizations/:orgId/intel/watchlist/:entryId', (0, permissionMiddleware_1.requirePermission)('intel', 'watchlist:manage'), (0, schemaValidation_1.validateSchema)(schemas_1.memberAuditSchemas.entryIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.memberAuditSchemas.updateWatchlistEntry, 'body'), rateLimiting_1.intelWriteRateLimiter, (req, res) => getWatchlistCtrl().updateEntry(req, res));
router.delete('/organizations/:orgId/intel/watchlist/:entryId', (0, permissionMiddleware_1.requirePermission)('intel', 'watchlist:manage'), (0, schemaValidation_1.validateSchema)(schemas_1.memberAuditSchemas.entryIdParam, 'params'), rateLimiting_1.intelDeleteRateLimiter, (req, res) => getWatchlistCtrl().deleteEntry(req, res));
router.get('/organizations/:orgId/intel/members/:userId/profile', (0, permissionMiddleware_1.requirePermission)('intel', 'audit:view'), (0, schemaValidation_1.validateSchema)(schemas_1.memberAuditSchemas.userIdParam, 'params'), rateLimiting_1.intelOperationsRateLimiter, (req, res) => getProfileCtrl().getProfile(req, res));
function setMemberAuditRoutes(app) {
    app.use('/api', router);
    app.use('/api/v2', router);
}
//# sourceMappingURL=memberAuditRoutes.js.map