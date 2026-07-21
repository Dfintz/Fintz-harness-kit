import { Router } from 'express';

import { PublicJobListingController } from '../../controllers/publicJobListingController';
import { authenticate } from '../../middleware/auth';
import { generalRateLimiter, organizationUpdateRateLimiter } from '../../middleware/rateLimiting';
import { validateSchema } from '../../middleware/schemaValidation';
import { paramSchemas, publicJobListingSchemas } from '../../schemas';

const router = Router();

// Lazy initialization to avoid EntityMetadataNotFoundError
let controller: PublicJobListingController;
const getController = () => {
  if (!controller) {
    controller = new PublicJobListingController();
  }
  return controller;
};

// ==================== PUBLIC ROUTES (NO AUTH) ====================

// List public job listings with filtering
router.get(
  '/directory/jobs',
  generalRateLimiter,
  validateSchema(publicJobListingSchemas.jobListingQuery, 'query'),
  (req, res) => getController().getJobListings(req, res)
);

// Get job listing statistics
router.get('/directory/jobs/stats', generalRateLimiter, (req, res) =>
  getController().getJobStats(req, res)
);

// Get available job filter options
router.get('/directory/jobs/options', generalRateLimiter, (req, res) =>
  getController().getFilterOptions(req, res)
);

// Get a specific job listing
router.get('/directory/jobs/:jobId', generalRateLimiter, (req, res) =>
  getController().getJobListing(req, res)
);

// Get job count for an organization
router.get('/directory/:organizationId/jobs/count', generalRateLimiter, (req, res) =>
  getController().getOrganizationJobCount(req, res)
);

// Get job count for an alliance
router.get('/directory/federations/:federationId/jobs/count', generalRateLimiter, (req, res) =>
  getController().getAllianceJobCount(req, res)
);

// ==================== AUTHENTICATED ORG/ALLIANCE JOB ROUTES ====================

/**
 * GET /api/v2/organizations/:id/jobs
 * Get organization's job listings (for management)
 */
router.get(
  '/organizations/:id/jobs',
  authenticate,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getController().getOrganizationJobs(req, res)
);

/**
 * POST /api/v2/organizations/:id/jobs
 * Create a job listing for an organization
 */
router.post(
  '/organizations/:id/jobs',
  authenticate,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(publicJobListingSchemas.createJobListing, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getController().createOrganizationJob(req, res)
);

/**
 * POST /api/v2/federations/:id/jobs
 * Create a job listing for an alliance
 */
router.post(
  '/federations/:id/jobs',
  authenticate,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(publicJobListingSchemas.createJobListing, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getController().createAllianceJob(req, res)
);

export { router };
