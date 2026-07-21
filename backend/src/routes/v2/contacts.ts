import { Request, Response, Router } from 'express';

const router = Router();

// ==================== CONTACT REQUESTS ====================

/**
 * GET /api/v2/contacts/requests
 * Get pending contact requests
 */
router.get('/requests', (req: Request, res: Response) => {
  res.success([]);
});

/**
 * POST /api/v2/contacts/requests
 * Send a contact request
 * Request body: { targetUserId: string, message?: string }
 */
router.post('/requests', (req: Request, res: Response) => {
  res.success({});
});

/**
 * POST /api/v2/contacts/requests/:requestId/accept
 * Accept contact request
 */
router.post('/requests/:requestId/accept', (req: Request, res: Response) => {
  res.success({});
});

/**
 * POST /api/v2/contacts/requests/:requestId/decline
 * Decline contact request
 */
router.post('/requests/:requestId/decline', (req: Request, res: Response) => {
  res.success({});
});

/**
 * GET /api/v2/contacts/list
 * Get user's contact list
 */
router.get('/list', (req: Request, res: Response) => {
  res.success([]);
});

/**
 * GET /api/v2/contacts/:contactId
 * Get contact details
 */
router.get('/:contactId', (req: Request, res: Response) => {
  res.success({});
});

/**
 * DELETE /api/v2/contacts/:contactId
 * Remove contact
 */
router.delete('/:contactId', (req: Request, res: Response) => {
  res.success({});
});

/**
 * PUT /api/v2/contacts/:contactId/notes
 * Update contact notes
 * Request body: { notes: string }
 */
router.put('/:contactId/notes', (req: Request, res: Response) => {
  res.success({});
});

export { router };
