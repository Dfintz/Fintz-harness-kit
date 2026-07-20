"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const jobApplicationController_1 = require("../controllers/jobApplicationController");
const publicJobListingController_1 = require("../controllers/publicJobListingController");
const auth_1 = require("../middleware/auth");
const rateLimiting_1 = require("../middleware/rateLimiting");
const schemaValidation_1 = require("../middleware/schemaValidation");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
exports.router = router;
let publicJobListingController;
const getPublicJobListingController = () => {
    if (!publicJobListingController) {
        publicJobListingController = new publicJobListingController_1.PublicJobListingController();
    }
    return publicJobListingController;
};
let jobApplicationController;
const getJobApplicationController = () => {
    if (!jobApplicationController) {
        jobApplicationController = new jobApplicationController_1.JobApplicationController();
    }
    return jobApplicationController;
};
router.get('/directory/jobs', rateLimiting_1.generalRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.publicJobListingSchemas.jobListingQuery, 'query'), (req, res) => getPublicJobListingController().getJobListings(req, res));
router.get('/directory/jobs/stats', rateLimiting_1.generalRateLimiter, (req, res) => getPublicJobListingController().getJobStats(req, res));
router.get('/directory/jobs/options', rateLimiting_1.generalRateLimiter, (req, res) => getPublicJobListingController().getFilterOptions(req, res));
router.get('/directory/jobs/:jobId', rateLimiting_1.generalRateLimiter, (req, res) => getPublicJobListingController().getJobListing(req, res));
router.get('/directory/:organizationId/jobs/count', rateLimiting_1.generalRateLimiter, (req, res) => getPublicJobListingController().getOrganizationJobCount(req, res));
router.get('/directory/federations/:federationId/jobs/count', rateLimiting_1.generalRateLimiter, (req, res) => getPublicJobListingController().getAllianceJobCount(req, res));
router.post('/jobs', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.publicJobListingSchemas.createJobListing, 'body'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getPublicJobListingController().createUserJob(req, res));
router.get('/organizations/:id/jobs', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), rateLimiting_1.generalRateLimiter, (req, res) => getPublicJobListingController().getOrganizationJobs(req, res));
router.post('/organizations/:id/jobs', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.publicJobListingSchemas.createJobListing, 'body'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getPublicJobListingController().createOrganizationJob(req, res));
router.post('/federations/:id/jobs', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.publicJobListingSchemas.createJobListing, 'body'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getPublicJobListingController().createAllianceJob(req, res));
router.patch('/jobs/:jobId', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.publicJobListingSchemas.updateJobListing, 'body'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getPublicJobListingController().updateJobListing(req, res));
router.delete('/jobs/:jobId', auth_1.authenticateToken, rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getPublicJobListingController().deleteJobListing(req, res));
router.post('/jobs/:jobId/cancel', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.jobId, 'params'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getPublicJobListingController().cancelJobListing(req, res));
router.post('/jobs/:jobId/crew/assign', auth_1.authenticateToken, rateLimiting_1.organizationUpdateRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.jobId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.publicJobListingSchemas.assignCrewRole, 'body'), (req, res) => getPublicJobListingController().assignCrewRole(req, res));
router.post('/jobs/:jobId/crew/unassign', auth_1.authenticateToken, rateLimiting_1.organizationUpdateRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.jobId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.publicJobListingSchemas.unassignCrewRole, 'body'), (req, res) => getPublicJobListingController().unassignCrewRole(req, res));
router.post('/jobs/:jobId/apply', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.jobId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.jobApplicationSchemas.applyToJob, 'body'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getJobApplicationController().applyToJob(req, res));
router.get('/jobs/:jobId/applications', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.jobId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.jobApplicationSchemas.applicationListQuery, 'query'), rateLimiting_1.generalRateLimiter, (req, res) => getJobApplicationController().getApplicationsForJob(req, res));
router.get('/jobs/:jobId/applications/my', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.jobId, 'params'), rateLimiting_1.generalRateLimiter, (req, res) => getJobApplicationController().getMyApplication(req, res));
router.patch('/jobs/:jobId/applications/:applicationId/review', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.jobIdAndApplicationId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.jobApplicationSchemas.reviewApplication, 'body'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getJobApplicationController().reviewApplication(req, res));
router.post('/jobs/:jobId/applications/:applicationId/withdraw', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.jobIdAndApplicationId, 'params'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getJobApplicationController().withdrawApplication(req, res));
router.get('/jobs/:jobId/waitlist', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.jobId, 'params'), rateLimiting_1.generalRateLimiter, (req, res) => getJobApplicationController().getWaitlist(req, res));
router.get('/my/applications', auth_1.authenticateToken, rateLimiting_1.generalRateLimiter, (req, res) => getJobApplicationController().getMyApplications(req, res));
//# sourceMappingURL=publicJobListingRoutes.js.map