/**
 * Contact Request Routes (API v2)
 *
 * Contact request and messaging endpoints supporting:
 * - Public contact form submission
 * - Organization contact request management
 * - Contact request responses and tracking
 *
 * Some routes allow public access, others require authentication
 */

import { Request, Response, Router } from 'express';

import { ContactRequestController } from '../../controllers/contactRequestController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { contactRequestSchemas } from '../../schemas';

const router = Router();

// Lazy initialization to avoid EntityMetadataNotFoundError
let contactRequestController: ContactRequestController;
const getController = () => {
  if (!contactRequestController) {
    contactRequestController = new ContactRequestController();
  }
  return contactRequestController;
};

// ==================== PUBLIC ROUTES (NO AUTH) ====================

/**
 * POST /api/v2/contact/submit
 * Submit a contact request to an organization or alliance
 * Request body: contact form data
 * No authentication required
 */
router.post(
  '/contact/submit',
  validateSchema(contactRequestSchemas.submitContactRequest, 'body'),
  (req: Request, res: Response) => getController().submitContactRequest(req, res)
);

/**
 * GET /api/v2/contact/options
 * Get available contact form options
 * Returns: contact types, target types, etc.
 * No authentication required
 */
router.get('/contact/options', (req: Request, res: Response) =>
  getController().getContactOptions(req, res)
);

// ==================== ORGANIZATION CONTACT MANAGEMENT (AUTHENTICATED) ====================

// All following routes require authentication
router.use(authenticate);

/**
 * GET /api/v2/contact-requests/:organizationId
 * Get organization contact requests
 * Query parameters: filters, sorting, pagination
 */
router.get(
  '/:organizationId',
  validateSchema(contactRequestSchemas.listContactRequestsQuery, 'query'),
  (req: Request, res: Response) => getController().getOrganizationContactRequests(req, res)
);

/**
 * GET /api/v2/contact-requests/:organizationId/stats
 * Get organization contact request statistics
 * Returns: count, status breakdown, etc.
 */
router.get('/:organizationId/stats', (req: Request, res: Response) =>
  getController().getOrganizationContactStats(req, res)
);

/**
 * GET /api/v2/contact-requests/:organizationId/:requestId
 * Get a specific contact request
 * Requires: valid UUIDs for organization and request
 */
router.get('/:organizationId/:requestId', (req: Request, res: Response) =>
  getController().getOrganizationContactRequest(req, res)
);

/**
 * PUT /api/v2/contact-requests/:organizationId/:requestId
 * Update contact request status or details
 * Request body: updated request data
 */
router.put(
  '/:organizationId/:requestId',
  validateSchema(contactRequestSchemas.updateContactRequest, 'body'),
  (req: Request, res: Response) => getController().updateOrganizationContactRequest(req, res)
);

export { router };
