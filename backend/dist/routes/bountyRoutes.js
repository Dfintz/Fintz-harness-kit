"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const bountyController_1 = require("../controllers/bountyController");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const tenantContext_1 = require("../middleware/tenantContext");
const schemas_1 = require("../schemas");
const bountySchemas_1 = require("../schemas/bountySchemas");
const router = (0, express_1.Router)();
exports.router = router;
let bountyController;
const getController = () => {
    if (!bountyController) {
        bountyController = new bountyController_1.BountyController();
    }
    return bountyController;
};
router.get('/public', (0, schemaValidation_1.validateSchema)(bountySchemas_1.bountySchemas.query, 'query'), (req, res) => getController().listBounties(req, res));
router.get('/public/:id', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getBounty(req, res));
router.get('/claims/pending', auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext, (req, res) => getController().getPendingClaims(req, res));
router.get('/claims/my-claims', auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext, (req, res) => getController().getMyClaimsWithStats(req, res));
router.get('/hunter/profile', auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext, (req, res) => getController().getHunterProfile(req, res));
router.get('/hunter/leaderboard', auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext, (req, res) => getController().getHunterLeaderboard(req, res));
router.get('/hunter/history', auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext, (req, res) => getController().getHunterHistory(req, res));
router.get('/hunter/analytics', auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext, (req, res) => getController().getHunterAnalytics(req, res));
router.get('/', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(bountySchemas_1.bountySchemas.query, 'query'), (req, res) => getController().listBounties(req, res));
router.get('/:id', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getBounty(req, res));
router.post('/:id/claim', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(bountySchemas_1.bountySchemas.claim, 'body'), (req, res) => getController().claimBounty(req, res));
router.post('/', auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext, (0, schemaValidation_1.validateSchema)(bountySchemas_1.bountySchemas.create, 'body'), (req, res) => getController().createBounty(req, res));
router.patch('/:id', auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(bountySchemas_1.bountySchemas.update, 'body'), (req, res) => getController().updateBounty(req, res));
router.delete('/:id', auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().deleteBounty(req, res));
router.get('/:id/claims', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getBountyClaims(req, res));
router.patch('/:bountyId/claims/:claimId', auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().updateClaim(req, res));
router.delete('/:bountyId/claims/:claimId', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().deleteClaim(req, res));
router.post('/:bountyId/claims/:claimId/submit', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(bountySchemas_1.claimSchemas.submit, 'body'), (req, res) => getController().submitClaim(req, res));
router.post('/:bountyId/claims/:claimId/evidence', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(bountySchemas_1.evidenceSchemas.submit, 'body'), (req, res) => getController().submitEvidence(req, res));
router.get('/:bountyId/claims/:claimId/evidence', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getClaimEvidence(req, res));
router.delete('/:bountyId/claims/:claimId/evidence/:evidenceId', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().deleteEvidence(req, res));
exports.default = router;
//# sourceMappingURL=bountyRoutes.js.map