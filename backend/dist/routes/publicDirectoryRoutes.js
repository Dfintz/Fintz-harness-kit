"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const publicDirectoryController_1 = require("../controllers/publicDirectoryController");
const auth_1 = require("../middleware/auth");
const authorization_1 = require("../middleware/authorization");
const rateLimiting_1 = require("../middleware/rateLimiting");
const schemaValidation_1 = require("../middleware/schemaValidation");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
exports.router = router;
let publicDirectoryController;
const getPublicDirectoryController = () => {
    if (!publicDirectoryController) {
        publicDirectoryController = new publicDirectoryController_1.PublicDirectoryController();
    }
    return publicDirectoryController;
};
router.get('/directory', rateLimiting_1.generalRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.publicDirectorySchemas.directoryQuery, 'query'), (req, res) => getPublicDirectoryController().getDirectory(req, res));
router.get('/directory/stats', rateLimiting_1.publicEndpointRateLimiter, (req, res) => getPublicDirectoryController().getDirectoryStats(req, res));
router.get('/directory/options', rateLimiting_1.generalRateLimiter, (req, res) => getPublicDirectoryController().getFilterOptions(req, res));
router.get('/directory/federations', rateLimiting_1.generalRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.publicDirectorySchemas.federationQuery, 'query'), (req, res) => getPublicDirectoryController().getPublicFederations(req, res));
router.get('/directory/federations/stats', rateLimiting_1.publicEndpointRateLimiter, (req, res) => getPublicDirectoryController().getPublicFederationStats(req, res));
router.get('/directory/federations/:federationId/seo', rateLimiting_1.generalRateLimiter, (req, res) => getPublicDirectoryController().getFederationSeoMeta(req, res));
router.get('/directory/federations/:federationId', rateLimiting_1.generalRateLimiter, (req, res) => getPublicDirectoryController().getPublicFederation(req, res));
router.get('/directory/seo', rateLimiting_1.publicEndpointRateLimiter, (req, res) => getPublicDirectoryController().getDirectorySeoMeta(req, res));
router.get('/directory/:organizationId/seo', rateLimiting_1.generalRateLimiter, (req, res) => getPublicDirectoryController().getOrganizationSeoMeta(req, res));
router.get('/directory/:identifier', rateLimiting_1.generalRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.identifier, 'params'), (req, res) => getPublicDirectoryController().getPublicProfile(req, res));
router.get('/sitemap.xml', rateLimiting_1.generalRateLimiter, (req, res) => getPublicDirectoryController().getSitemap(req, res));
router.get('/organizations/:id/public-profile', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), rateLimiting_1.generalRateLimiter, (req, res) => getPublicDirectoryController().getOwnProfile(req, res));
router.patch('/organizations/:id/public-profile', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.publicDirectorySchemas.updateProfile, 'body'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getPublicDirectoryController().updateOwnProfile(req, res));
router.post('/organizations/:id/public-profile/sync-rsi', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getPublicDirectoryController().syncFromRsi(req, res));
router.patch('/admin/directory/:organizationId/verify', auth_1.authenticateToken, authorization_1.requireAdmin, (0, schemaValidation_1.validateSchema)(schemas_1.publicDirectorySchemas.setVerification, 'body'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getPublicDirectoryController().setVerificationStatus(req, res));
exports.default = router;
//# sourceMappingURL=publicDirectoryRoutes.js.map