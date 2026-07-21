import { Router } from 'express';

import { JobApplicationController } from '../../controllers/jobApplicationController';
import { PublicJobListingController } from '../../controllers/publicJobListingController';
import { authenticate } from '../../middleware/auth';
import { generalRateLimiter, organizationUpdateRateLimiter } from '../../middleware/rateLimiting';
import { validateSchema } from '../../middleware/schemaValidation';
import { jobApplicationSchemas, paramSchemas, publicJobListingSchemas } from '../../schemas';

const router = Router();

// Lazy initialization to avoid EntityMetadataNotFoundError
let jobController: PublicJobListingController;
const getJobController = () => {
  if (!jobController) {
    jobController = new PublicJobListingController();
  }
  return jobController;
};

let appController: JobApplicationController;
const getAppController = () => {
  if (!appController) {
    appController = new JobApplicationController();
  }
  return appController;
};

// ==================== USER-SCOPED ROUTES ====================
// These MUST come before /:jobId routes to avoid the wildcard matching
// "my-applications" as a jobId parameter.

/**
 * GET /api/v2/jobs/my-applications
 * Get all applications by the current user
 */
router.get('/my-applications', authenticate, generalRateLimiter, (req, res) =>
  getAppController().getMyApplications(req, res)
);

// ==================== AUTHENTICATED JOB LISTING MANAGEMENT ====================

/**
 * POST /api/v2/jobs
 * Create a job listing for an individual user (no org required)
 */
router.post(
  '/',
  authenticate,
  validateSchema(publicJobListingSchemas.createJobListing, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getJobController().createUserJob(req, res)
);

/**
 * PATCH /api/v2/jobs/:jobId
 * Update a job listing
 */
router.patch(
  '/:jobId',
  authenticate,
  validateSchema(publicJobListingSchemas.updateJobListing, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getJobController().updateJobListing(req, res)
);

/**
 * DELETE /api/v2/jobs/:jobId
 * Delete a job listing
 */
router.delete(
  '/:jobId',
  authenticate,
  validateSchema(paramSchemas.jobId, 'params'),
  organizationUpdateRateLimiter,
  (req, res) => getJobController().deleteJobListing(req, res)
);

/**
 * POST /api/v2/jobs/:jobId/cancel
 * Cancel (deactivate) a job listing
 */
router.post(
  '/:jobId/cancel',
  authenticate,
  validateSchema(paramSchemas.jobId, 'params'),
  organizationUpdateRateLimiter,
  (req, res) => getJobController().cancelJobListing(req, res)
);

/**
 * POST /api/v2/jobs/:jobId/crew/assign
 * Assign a user to a crew role on a ship
 */
router.post(
  '/:jobId/crew/assign',
  authenticate,
  validateSchema(paramSchemas.jobId, 'params'),
  validateSchema(publicJobListingSchemas.assignCrewRole, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getJobController().assignCrewRole(req, res)
);

/**
 * POST /api/v2/jobs/:jobId/crew/unassign
 * Unassign a user from a crew role on a ship
 */
router.post(
  '/:jobId/crew/unassign',
  authenticate,
  validateSchema(paramSchemas.jobId, 'params'),
  validateSchema(publicJobListingSchemas.unassignCrewRole, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getJobController().unassignCrewRole(req, res)
);

// ==================== JOB APPLICATION ROUTES ====================

/**
 * POST /api/v2/jobs/:jobId/apply
 * Apply for a job listing
 */
router.post(
  '/:jobId/apply',
  authenticate,
  validateSchema(paramSchemas.jobId, 'params'),
  validateSchema(jobApplicationSchemas.applyToJob, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getAppController().applyToJob(req, res)
);

/**
 * GET /api/v2/jobs/:jobId/applications
 * Get applications for a job listing (owner/admin)
 */
router.get(
  '/:jobId/applications',
  authenticate,
  generalRateLimiter,
  validateSchema(paramSchemas.jobId, 'params'),
  validateSchema(jobApplicationSchemas.applicationListQuery, 'query'),
  (req, res) => getAppController().getApplicationsForJob(req, res)
);

/**
 * GET /api/v2/jobs/:jobId/applications/my
 * Get current user's application for a listing
 */
router.get(
  '/:jobId/applications/my',
  authenticate,
  generalRateLimiter,
  validateSchema(paramSchemas.jobId, 'params'),
  (req, res) => getAppController().getMyApplication(req, res)
);

/**
 * PATCH /api/v2/jobs/:jobId/applications/:applicationId/review
 * Review (approve/reject/waitlist) an application
 */
router.patch(
  '/:jobId/applications/:applicationId/review',
  authenticate,
  validateSchema(paramSchemas.jobIdAndApplicationId, 'params'),
  validateSchema(jobApplicationSchemas.reviewApplication, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getAppController().reviewApplication(req, res)
);

/**
 * POST /api/v2/jobs/:jobId/applications/:applicationId/withdraw
 * Withdraw own application
 */
router.post(
  '/:jobId/applications/:applicationId/withdraw',
  authenticate,
  validateSchema(paramSchemas.jobIdAndApplicationId, 'params'),
  organizationUpdateRateLimiter,
  (req, res) => getAppController().withdrawApplication(req, res)
);

/**
 * GET /api/v2/jobs/:jobId/waitlist
 * Get waitlist for a job listing (owner/admin)
 */
router.get(
  '/:jobId/waitlist',
  authenticate,
  generalRateLimiter,
  validateSchema(paramSchemas.jobId, 'params'),
  (req, res) => getAppController().getWaitlist(req, res)
);

export { router };
