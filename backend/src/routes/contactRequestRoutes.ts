import { Router } from 'express';

import { ContactRequestController } from '../controllers/contactRequestController';
import { authenticateToken } from '../middleware/auth';
import { generalRateLimiter, organizationUpdateRateLimiter } from '../middleware/rateLimiting';
import { validateSchema } from '../middleware/schemaValidation';
import { contactRequestSchemas, paramSchemas } from '../schemas';

const router = Router();

let contactRequestController: ContactRequestController;
const getContactRequestController = () => {
  if (!contactRequestController) {
    contactRequestController = new ContactRequestController();
  }
  return contactRequestController;
};

/**
 * Contact Request Routes
 *
 * Internal messaging system for organizations and alliances.
 * Provides authenticated contact form submission, inbox management,
 * and reply threads with real-time notifications.
 */

// ==================== CONTACT SUBMISSION (AUTHENTICATED) ====================

/**
 * Submit a contact request to an organization or alliance
 * POST /api/directory/contact
 * Requires authentication
 */
router.post(
  '/directory/contact',
  authenticateToken,
  generalRateLimiter,
  validateSchema(contactRequestSchemas.submitContactRequest, 'body'),
  (req, res) => getContactRequestController().submitContactRequest(req, res)
);

/**
 * Get contact form options (contact types, target types)
 * GET /api/directory/contact/options
 * No authentication required
 */
router.get('/directory/contact/options', generalRateLimiter, (req, res) =>
  getContactRequestController().getContactOptions(req, res)
);

// ==================== USER INBOX (AUTHENTICATED) ====================

/**
 * Get current user's sent messages
 * GET /api/inbox/sent
 */
router.get('/inbox/sent', authenticateToken, generalRateLimiter, (req, res) =>
  getContactRequestController().getSentMessages(req, res)
);

/**
 * Get unread inbox count
 * GET /api/inbox/unread-count
 */
router.get('/inbox/unread-count', authenticateToken, generalRateLimiter, (req, res) =>
  getContactRequestController().getUnreadCount(req, res)
);

/**
 * Get a specific inbox message with replies
 * GET /api/inbox/:requestId
 */
router.get('/inbox/:requestId', authenticateToken, generalRateLimiter, (req, res) =>
  getContactRequestController().getInboxMessage(req, res)
);

/**
 * Add a reply to a message (sender replying back)
 * POST /api/inbox/:requestId/replies
 */
router.post(
  '/inbox/:requestId/replies',
  authenticateToken,
  organizationUpdateRateLimiter,
  validateSchema(contactRequestSchemas.addReply, 'body'),
  (req, res) => getContactRequestController().addSenderReply(req, res)
);

/**
 * Archive a sent message (hide it from the inbox)
 * PATCH /api/inbox/:requestId/archive
 */
router.patch(
  '/inbox/:requestId/archive',
  authenticateToken,
  organizationUpdateRateLimiter,
  (req, res) => getContactRequestController().archiveMessage(req, res)
);

/**
 * Permanently delete a sent message
 * DELETE /api/inbox/:requestId
 */
router.delete('/inbox/:requestId', authenticateToken, organizationUpdateRateLimiter, (req, res) =>
  getContactRequestController().deleteMessage(req, res)
);

// ==================== ORGANIZATION CONTACT MANAGEMENT (AUTHENTICATED) ====================

/**
 * Get organization contact requests
 * GET /api/organizations/:id/contact-requests
 */
router.get(
  '/organizations/:id/contact-requests',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(contactRequestSchemas.listContactRequestsQuery, 'query'),
  generalRateLimiter,
  (req, res) => getContactRequestController().getOrganizationContactRequests(req, res)
);

/**
 * Get organization contact request statistics
 * GET /api/organizations/:id/contact-requests/stats
 */
router.get(
  '/organizations/:id/contact-requests/stats',
  authenticateToken,
  validateSchema(paramSchemas.id, 'params'),
  generalRateLimiter,
  (req, res) => getContactRequestController().getOrganizationContactStats(req, res)
);

/**
 * Get a specific organization contact request
 * GET /api/organizations/:id/contact-requests/:requestId
 */
router.get(
  '/organizations/:id/contact-requests/:requestId',
  authenticateToken,
  validateSchema(contactRequestSchemas.organizationContactParams, 'params'),
  generalRateLimiter,
  (req, res) => getContactRequestController().getOrganizationContactRequest(req, res)
);

/**
 * Get replies for an org contact request
 * GET /api/organizations/:id/contact-requests/:requestId/replies
 */
router.get(
  '/organizations/:id/contact-requests/:requestId/replies',
  authenticateToken,
  validateSchema(contactRequestSchemas.organizationContactParams, 'params'),
  generalRateLimiter,
  (req, res) => getContactRequestController().getOrganizationContactReplies(req, res)
);

/**
 * Add org admin reply to a contact request
 * POST /api/organizations/:id/contact-requests/:requestId/replies
 */
router.post(
  '/organizations/:id/contact-requests/:requestId/replies',
  authenticateToken,
  validateSchema(contactRequestSchemas.organizationContactParams, 'params'),
  validateSchema(contactRequestSchemas.addReply, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getContactRequestController().addOrganizationReply(req, res)
);

/**
 * Update an organization contact request
 * PATCH /api/organizations/:id/contact-requests/:requestId
 */
router.patch(
  '/organizations/:id/contact-requests/:requestId',
  authenticateToken,
  validateSchema(contactRequestSchemas.organizationContactParams, 'params'),
  validateSchema(contactRequestSchemas.updateContactRequest, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getContactRequestController().updateOrganizationContactRequest(req, res)
);

/**
 * Delete an organization contact request
 * DELETE /api/organizations/:id/contact-requests/:requestId
 */
router.delete(
  '/organizations/:id/contact-requests/:requestId',
  authenticateToken,
  validateSchema(contactRequestSchemas.organizationContactParams, 'params'),
  organizationUpdateRateLimiter,
  (req, res) => getContactRequestController().deleteOrganizationContactRequest(req, res)
);

// ==================== ALLIANCE CONTACT MANAGEMENT (AUTHENTICATED) ====================

/**
 * Get alliance contact requests
 * GET /api/federations/:allianceId/contact-requests
 */
router.get(
  '/federations/:allianceId/contact-requests',
  authenticateToken,
  validateSchema(contactRequestSchemas.listContactRequestsQuery, 'query'),
  generalRateLimiter,
  (req, res) => getContactRequestController().getAllianceContactRequests(req, res)
);

/**
 * Get alliance contact request statistics
 * GET /api/federations/:allianceId/contact-requests/stats
 */
router.get(
  '/federations/:allianceId/contact-requests/stats',
  authenticateToken,
  generalRateLimiter,
  (req, res) => getContactRequestController().getAllianceContactStats(req, res)
);

/**
 * Get a specific alliance contact request
 * GET /api/federations/:allianceId/contact-requests/:requestId
 */
router.get(
  '/federations/:allianceId/contact-requests/:requestId',
  authenticateToken,
  validateSchema(contactRequestSchemas.allianceContactParams, 'params'),
  generalRateLimiter,
  (req, res) => getContactRequestController().getAllianceContactRequest(req, res)
);

/**
 * Update an alliance contact request
 * PATCH /api/federations/:allianceId/contact-requests/:requestId
 */
router.patch(
  '/federations/:allianceId/contact-requests/:requestId',
  authenticateToken,
  validateSchema(contactRequestSchemas.allianceContactParams, 'params'),
  validateSchema(contactRequestSchemas.updateContactRequest, 'body'),
  organizationUpdateRateLimiter,
  (req, res) => getContactRequestController().updateAllianceContactRequest(req, res)
);

/**
 * Delete an alliance contact request
 * DELETE /api/federations/:allianceId/contact-requests/:requestId
 */
router.delete(
  '/federations/:allianceId/contact-requests/:requestId',
  authenticateToken,
  validateSchema(contactRequestSchemas.allianceContactParams, 'params'),
  organizationUpdateRateLimiter,
  (req, res) => getContactRequestController().deleteAllianceContactRequest(req, res)
);

export { router };

/**
 * Route Summary:
 *
 * CONTACT SUBMISSION (1):
 * - POST /api/directory/contact - Submit a contact request (authenticated)
 *
 * PUBLIC (1):
 * - GET  /api/directory/contact/options - Get contact form options
 *
 * USER INBOX (4):
 * - GET  /api/inbox/sent - Get user's sent messages
 * - GET  /api/inbox/unread-count - Get unread count
 * - GET  /api/inbox/:requestId - Get message with replies
 * - POST /api/inbox/:requestId/replies - Reply to a message
 *
 * ORGANIZATION CONTACT MANAGEMENT (7):
 * - GET    /api/organizations/:id/contact-requests - List contact requests
 * - GET    /api/organizations/:id/contact-requests/stats - Get statistics
 * - GET    /api/organizations/:id/contact-requests/:requestId - Get specific request
 * - GET    /api/organizations/:id/contact-requests/:requestId/replies - Get replies
 * - POST   /api/organizations/:id/contact-requests/:requestId/replies - Add org reply
 * - PATCH  /api/organizations/:id/contact-requests/:requestId - Update request
 * - DELETE /api/organizations/:id/contact-requests/:requestId - Delete request
 *
 * ALLIANCE CONTACT MANAGEMENT (5):
 * - GET    /api/federations/:allianceId/contact-requests - List
 * - GET    /api/federations/:allianceId/contact-requests/stats - Stats
 * - GET    /api/federations/:allianceId/contact-requests/:requestId - Get
 * - PATCH  /api/federations/:allianceId/contact-requests/:requestId - Update
 * - DELETE /api/federations/:allianceId/contact-requests/:requestId - Delete
 *
 * TOTAL: 18 endpoints
 */
