"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const publicJobListingController_1 = require("../../controllers/publicJobListingController");
const auth_1 = require("../../middleware/auth");
const rateLimiting_1 = require("../../middleware/rateLimiting");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
let controller;
const getController = () => {
    if (!controller) {
        controller = new publicJobListingController_1.PublicJobListingController();
    }
    return controller;
};
router.get('/directory/jobs', rateLimiting_1.generalRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.publicJobListingSchemas.jobListingQuery, 'query'), (req, res) => getController().getJobListings(req, res));
router.get('/directory/jobs/stats', rateLimiting_1.generalRateLimiter, (req, res) => getController().getJobStats(req, res));
router.get('/directory/jobs/options', rateLimiting_1.generalRateLimiter, (req, res) => getController().getFilterOptions(req, res));
router.get('/directory/jobs/:jobId', rateLimiting_1.generalRateLimiter, (req, res) => getController().getJobListing(req, res));
router.get('/directory/:organizationId/jobs/count', rateLimiting_1.generalRateLimiter, (req, res) => getController().getOrganizationJobCount(req, res));
router.get('/directory/federations/:federationId/jobs/count', rateLimiting_1.generalRateLimiter, (req, res) => getController().getAllianceJobCount(req, res));
router.get('/organizations/:id/jobs', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), rateLimiting_1.generalRateLimiter, (req, res) => getController().getOrganizationJobs(req, res));
router.post('/organizations/:id/jobs', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.publicJobListingSchemas.createJobListing, 'body'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getController().createOrganizationJob(req, res));
router.post('/federations/:id/jobs', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.publicJobListingSchemas.createJobListing, 'body'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getController().createAllianceJob(req, res));
//# sourceMappingURL=publicJobListing.js.map