"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const jobApplicationController_1 = require("../../controllers/jobApplicationController");
const publicJobListingController_1 = require("../../controllers/publicJobListingController");
const auth_1 = require("../../middleware/auth");
const rateLimiting_1 = require("../../middleware/rateLimiting");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
let jobController;
const getJobController = () => {
    if (!jobController) {
        jobController = new publicJobListingController_1.PublicJobListingController();
    }
    return jobController;
};
let appController;
const getAppController = () => {
    if (!appController) {
        appController = new jobApplicationController_1.JobApplicationController();
    }
    return appController;
};
router.get('/my-applications', auth_1.authenticate, rateLimiting_1.generalRateLimiter, (req, res) => getAppController().getMyApplications(req, res));
router.post('/', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.publicJobListingSchemas.createJobListing, 'body'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getJobController().createUserJob(req, res));
router.patch('/:jobId', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.publicJobListingSchemas.updateJobListing, 'body'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getJobController().updateJobListing(req, res));
router.delete('/:jobId', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.jobId, 'params'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getJobController().deleteJobListing(req, res));
router.post('/:jobId/cancel', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.jobId, 'params'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getJobController().cancelJobListing(req, res));
router.post('/:jobId/crew/assign', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.jobId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.publicJobListingSchemas.assignCrewRole, 'body'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getJobController().assignCrewRole(req, res));
router.post('/:jobId/crew/unassign', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.jobId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.publicJobListingSchemas.unassignCrewRole, 'body'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getJobController().unassignCrewRole(req, res));
router.post('/:jobId/apply', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.jobId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.jobApplicationSchemas.applyToJob, 'body'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getAppController().applyToJob(req, res));
router.get('/:jobId/applications', auth_1.authenticate, rateLimiting_1.generalRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.jobId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.jobApplicationSchemas.applicationListQuery, 'query'), (req, res) => getAppController().getApplicationsForJob(req, res));
router.get('/:jobId/applications/my', auth_1.authenticate, rateLimiting_1.generalRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.jobId, 'params'), (req, res) => getAppController().getMyApplication(req, res));
router.patch('/:jobId/applications/:applicationId/review', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.jobIdAndApplicationId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.jobApplicationSchemas.reviewApplication, 'body'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getAppController().reviewApplication(req, res));
router.post('/:jobId/applications/:applicationId/withdraw', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.jobIdAndApplicationId, 'params'), rateLimiting_1.organizationUpdateRateLimiter, (req, res) => getAppController().withdrawApplication(req, res));
router.get('/:jobId/waitlist', auth_1.authenticate, rateLimiting_1.generalRateLimiter, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.jobId, 'params'), (req, res) => getAppController().getWaitlist(req, res));
//# sourceMappingURL=jobs.js.map