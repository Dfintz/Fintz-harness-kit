"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const bountyController_1 = require("../../controllers/bountyController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const schemas_1 = require("../../schemas");
const bountySchemas_1 = require("../../schemas/bountySchemas");
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
router.use(auth_1.authenticate);
router.get('/claims/pending', tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext, (req, res) => getController().getPendingClaims(req, res));
router.get('/claims/my-claims', tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext, (0, schemaValidation_1.validateSchema)(bountySchemas_1.claimSchemas.query, 'query'), (req, res) => getController().getMyClaimsWithStats(req, res));
router.use('/hunter', tenantContext_1.tenantContextMiddleware);
router.get('/hunter/profile', (req, res) => getController().getHunterProfile(req, res));
router.get('/hunter/leaderboard', (req, res) => getController().getHunterLeaderboard(req, res));
router.get('/hunter/history', (req, res) => getController().getHunterHistory(req, res));
router.get('/hunter/analytics', (req, res) => getController().getHunterAnalytics(req, res));
router.get('/', tenantContext_1.tenantContextMiddleware, (0, schemaValidation_1.validateSchema)(bountySchemas_1.bountySchemas.query, 'query'), (req, res) => getController().listBounties(req, res));
router.get('/:id', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getBounty(req, res));
router.post('/:id/claim', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(bountySchemas_1.bountySchemas.claim, 'body'), (req, res) => getController().claimBounty(req, res));
router.get('/:id/claims', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getBountyClaims(req, res));
router.use(tenantContext_1.tenantContextMiddleware);
router.use(tenantContext_1.requireTenantContext);
router.post('/', (0, schemaValidation_1.validateSchema)(bountySchemas_1.bountySchemas.create, 'body'), (req, res) => getController().createBounty(req, res));
router.patch('/:id', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(bountySchemas_1.bountySchemas.update, 'body'), (req, res) => getController().updateBounty(req, res));
router.delete('/:id', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().deleteBounty(req, res));
router.patch('/:bountyId/claims/:claimId', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().updateClaim(req, res));
router.delete('/:bountyId/claims/:claimId', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().deleteClaim(req, res));
router.post('/:bountyId/claims/:claimId/submit', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(bountySchemas_1.claimSchemas.submit, 'body'), (req, res) => getController().submitClaim(req, res));
router.post('/:bountyId/claims/:claimId/evidence', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(bountySchemas_1.evidenceSchemas.submit, 'body'), (req, res) => getController().submitEvidence(req, res));
router.get('/:bountyId/claims/:claimId/evidence', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getClaimEvidence(req, res));
router.delete('/:bountyId/claims/:claimId/evidence/:evidenceId', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().deleteEvidence(req, res));
//# sourceMappingURL=bounties.js.map