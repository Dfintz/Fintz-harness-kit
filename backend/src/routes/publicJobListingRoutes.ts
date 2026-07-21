import { Router } from 'express';

import { JobApplicationController } from '../controllers/jobApplicationController';
import { PublicJobListingController } from '../controllers/publicJobListingController';
import { authenticateToken } from '../middleware/auth';
import { generalRateLimiter, organizationUpdateRateLimiter } from '../middleware/rateLimiting';
import { validateSchema } from '../middleware/schemaValidation';
import { jobApplicationSchemas, paramSchemas, publicJobListingSchemas } from '../schemas';

const router = Router();

let publicJobListingController: PublicJobListingController;
const getPublicJobListingController = () => {
  if (!publicJobListingController) {
    publicJobListingController = new PublicJobListingController();
  }
  return publicJobListingController;
};

let jobApplicationController: JobApplicationController;
const getJobApplicationController = () => {
  if (!jobApplicationController) {
    jobApplicationController = new JobApplicationController();
  }
  return jobApplicationController;
};

/**
 * Public Job Listing Routes
 *
 * Provides endpoints for public job listings in the organization directory.
 * Phase 3: Public Job Listings feature
 *
 * Routes are organized into:
 * - Public routes (no auth required) for browsing jobs
 * - Authenticated routes for managing job listings
 */

// ==================== PUBLIC ROUTES (NO AUTH) ====================

/**
 * Get public job listings
 * GET /api/directory/jobs
 * Supports filtering by org, alliance, type, focus, pay, etc.
 */
router.get(
  '/directory/jobs',
  generalRateLimiter,
  validateSchema(publicJobListingSchemas.jobListingQuery, 'query'),
  (req, res) => getPublicJobListingController().getJobListings(req, res)
);

/**
 * Get job listing statistics
 * GET /api/directory/jobs/stats
 * Returns aggregate stats about job listings
 */
router.get('/directory/jobs/stats', generalRateLimiter, (req, res) =>
  getPublicJobListingController().getJobStats(req, res)
);

/**
 * Get available filter options for jobs
 * GET /api/directory/jobs/options
 * Returns valid values for filters (job types, pay types, etc.)
 */
router.get('/directory/jobs/options', generalRateLimiter, (req, res) =>
  getPublicJobListingController().getFilterOptions(req, res)
);

/**
 * Get a specific job listing
 * GET /api/directory/jobs/:jobId
 * Returns job details if active and not expired
 */
router.get('/directory/jobs/:jobId', generalRateLimiter, (req, res) =>
  getPublicJobListingController().getJobListing(req, res)
);

/**
 * Get job count for an organization
 * GET /api/directory/:organizationId/jobs/count
 * Returns the number of active jobs for the organization
 */
router.get('/directory/:organizationId/jobs/count', generalRateLimiter, (req, res) =>
  getPublicJobListingController().getOrganizationJobCount(req, res)
);

/**
 * Get job count for an alliance
 * GET /api/directory/federations/:federationId/jobs/count
 * Returns the number of active jobs for the alliance
 */
router.get('/directory/federations/:federationId/jobs/count', generalRateLimiter, (req, res) =>
  getPublicJobListingController().getAllianceJobCount(req, res)
);

// ==================== AUTHENTICATED ROUTES ====================

/**
 * Create a job listing for an individual user (no org required)
 * POST /api/jobs
 */
router.post(
  '/jobs',
  authenticateToken,
  validateSchema(publicJobListingSchemas.createJobListing, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getPublicJobListingController().createUserJob(req, res)
);

/**
 * Get organization's job listings (for management)
 * GET /api/organizations/:id/jobs
 */
router.get(
  '/organizations/:id/jobs',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getPublicJobListingController().getOrganizationJobs(req, res)
);

/**
 * Create a job listing for an organization
 * POST /api/organizations/:id/jobs
 */
router.post(
  '/organizations/:id/jobs',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(publicJobListingSchemas.createJobListing, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getPublicJobListingController().createOrganizationJob(req, res)
);

/**
 * Create a job listing for an alliance
 * POST /api/federations/:id/jobs
 */
router.post(
  '/federations/:id/jobs',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(publicJobListingSchemas.createJobListing, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getPublicJobListingController().createAllianceJob(req, res)
);

/**
 * Update a job listing
 * PATCH /api/jobs/:jobId
 */
router.patch(
  '/jobs/:jobId',
  authenticateToken,
  validateSchema(publicJobListingSchemas.updateJobListing, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getPublicJobListingController().updateJobListing(req, res)
);

/**
 * Delete a job listing
 * DELETE /api/jobs/:jobId
 */
router.delete('/jobs/:jobId', authenticateToken, organizationUpdateRateLimiter, (req, res) =>
  getPublicJobListingController().deleteJobListing(req, res)
);

/**
 * Cancel (deactivate) a job listing
 * POST /api/jobs/:jobId/cancel
 */
router.post(
  '/jobs/:jobId/cancel',
  authenticateToken,
  validateSchema(paramSchemas.jobId, 'params'),
  organizationUpdateRateLimiter,
  (req, res) => getPublicJobListingController().cancelJobListing(req, res)
);

/**
 * Assign a user to a crew role on a ship
 * POST /api/jobs/:jobId/crew/assign
 * Requires authentication and ownership
 */
router.post(
  '/jobs/:jobId/crew/assign',
  authenticateToken,
  organizationUpdateRateLimiter,
  validateSchema(paramSchemas.jobId, 'params'),
  validateSchema(publicJobListingSchemas.assignCrewRole, 'body'),
  (req, res) => getPublicJobListingController().assignCrewRole(req, res)
);

/**
 * Unassign a user from a crew role on a ship
 * POST /api/jobs/:jobId/crew/unassign
 * Requires authentication and ownership
 */
router.post(
  '/jobs/:jobId/crew/unassign',
  authenticateToken,
  organizationUpdateRateLimiter,
  validateSchema(paramSchemas.jobId, 'params'),
  validateSchema(publicJobListingSchemas.unassignCrewRole, 'body'),
  (req, res) => getPublicJobListingController().unassignCrewRole(req, res)
);

// ==================== JOB APPLICATION ROUTES ====================

/**
 * Apply to a job listing
 * POST /api/jobs/:jobId/apply
 * Requires authentication
 */
router.post(
  '/jobs/:jobId/apply',
  authenticateToken,
  validateSchema(paramSchemas.jobId, 'params'),
  validateSchema(jobApplicationSchemas.applyToJob, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getJobApplicationController().applyToJob(req, res)
);

/**
 * Get applications for a job listing (owner/admin)
 * GET /api/jobs/:jobId/applications
 */
router.get(
  '/jobs/:jobId/applications',
  authenticateToken,
  validateSchema(paramSchemas.jobId, 'params'),
  validateSchema(jobApplicationSchemas.applicationListQuery, 'query'),
  generalRateLimiter,
  (req, res) => getJobApplicationController().getApplicationsForJob(req, res)
);

/**
 * Get current user's application for a listing
 * GET /api/jobs/:jobId/applications/my
 */
router.get(
  '/jobs/:jobId/applications/my',
  authenticateToken,
  validateSchema(paramSchemas.jobId, 'params'),
  generalRateLimiter,
  (req, res) => getJobApplicationController().getMyApplication(req, res)
);

/**
 * Review (approve/reject/waitlist) an application
 * PATCH /api/jobs/:jobId/applications/:applicationId/review
 */
router.patch(
  '/jobs/:jobId/applications/:applicationId/review',
  authenticateToken,
  validateSchema(paramSchemas.jobIdAndApplicationId, 'params'),
  validateSchema(jobApplicationSchemas.reviewApplication, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getJobApplicationController().reviewApplication(req, res)
);

/**
 * Withdraw own application
 * POST /api/jobs/:jobId/applications/:applicationId/withdraw
 */
router.post(
  '/jobs/:jobId/applications/:applicationId/withdraw',
  authenticateToken,
  validateSchema(paramSchemas.jobIdAndApplicationId, 'params'),
  organizationUpdateRateLimiter,
  (req, res) => getJobApplicationController().withdrawApplication(req, res)
);

/**
 * Get waitlist for a job listing (owner/admin)
 * GET /api/jobs/:jobId/waitlist
 */
router.get(
  '/jobs/:jobId/waitlist',
  authenticateToken,
  validateSchema(paramSchemas.jobId, 'params'),
  generalRateLimiter,
  (req, res) => getJobApplicationController().getWaitlist(req, res)
);

/**
 * Get all applications by the current user (across all listings)
 * GET /api/my/applications
 */
router.get('/my/applications', authenticateToken, generalRateLimiter, (req, res) =>
  getJobApplicationController().getMyApplications(req, res)
);

export { router };

/**
 * Route Summary:
 *
 * PUBLIC JOB ROUTES (6):
 * - GET  /api/directory/jobs - List public job listings with filtering
 * - GET  /api/directory/jobs/stats - Get job listing statistics
 * - GET  /api/directory/jobs/options - Get filter options
 * - GET  /api/directory/jobs/:jobId - Get specific job listing
 * - GET  /api/directory/:organizationId/jobs/count - Get org job count
 * - GET  /api/directory/federations/:federationId/jobs/count - Get alliance job count
 *
 * AUTHENTICATED JOB LISTING MANAGEMENT (7):
 * - GET    /api/organizations/:id/jobs - Get org's listings for management
 * - POST   /api/organizations/:id/jobs - Create org job listing
 * - POST   /api/federations/:id/jobs - Create alliance job listing
 * - PATCH  /api/jobs/:jobId - Update job listing
 * - DELETE /api/jobs/:jobId - Delete job listing
 * - POST   /api/jobs/:jobId/crew/assign - Assign user to crew role
 * - POST   /api/jobs/:jobId/crew/unassign - Unassign user from crew role
 *
 * JOB APPLICATION ROUTES (7):
 * - POST  /api/jobs/:jobId/apply - Apply to a job listing
 * - GET   /api/jobs/:jobId/applications - Get applications for a listing (owner/admin)
 * - GET   /api/jobs/:jobId/applications/my - Get current user's application
 * - PATCH /api/jobs/:jobId/applications/:applicationId/review - Review an application
 * - POST  /api/jobs/:jobId/applications/:applicationId/withdraw - Withdraw application
 * - GET   /api/jobs/:jobId/waitlist - Get waitlist for a listing (owner/admin)
 * - GET   /api/my/applications - Get all applications by current user
 *
 * TOTAL: 20 endpoints
 */
