/**
 * Tickets Routes (API v2)
 *
 * Support ticket management endpoints supporting:
 * - Ticket CRUD operations
 * - Ticket messaging and updates
 * - Ticket assignment and status tracking
 * - Ticket statistics and analytics
 *
 * All routes require authentication and organization context
 */

import { Request, Response, Router } from 'express';

import { TicketController } from '../../controllers/ticketController';
import { botOrUserAuth } from '../../middleware/botOrUserAuth';
import { validateSchema } from '../../middleware/schemaValidation';
import { paramSchemas, ticketSchemas } from '../../schemas';

const router = Router();

// All routes require authentication and organization context.
// botOrUserAuth accepts both JWT (browser) and bot-internal-token (Discord bot)
// and sets up tenant context for both paths.
router.use(botOrUserAuth);

// Lazy initialization to avoid EntityMetadataNotFoundError
let ticketController: TicketController;
const getController = () => {
  if (!ticketController) {
    ticketController = new TicketController();
  }
  return ticketController;
};

// ==================== STATISTICS ====================

/**
 * GET /api/v2/tickets/stats
 * Get ticket statistics for organization
 * Returns: open/closed counts, response times, etc.
 */
router.get('/stats', (req: Request, res: Response) => getController().getStats(req, res));

/**
 * GET /api/v2/tickets/routing/stats
 * Get ticket routing engine statistics
 */
router.get('/routing/stats', (req: Request, res: Response) =>
  getController().getRoutingStats(req, res)
);

/**
 * GET /api/v2/tickets/routing/rules
 * List routing rules for organization
 */
router.get('/routing/rules', (req: Request, res: Response) =>
  getController().getRoutingRules(req, res)
);

/**
 * POST /api/v2/tickets/routing/rules
 * Create a routing rule
 */
router.post(
  '/routing/rules',
  validateSchema(ticketSchemas.createRoutingRule, 'body'),
  (req: Request, res: Response) => getController().createRoutingRule(req, res)
);

/**
 * PATCH /api/v2/tickets/routing/rules/:ruleId
 * Update a routing rule
 */
router.patch(
  '/routing/rules/:ruleId',
  validateSchema(ticketSchemas.routingRuleIdParam, 'params'),
  validateSchema(ticketSchemas.updateRoutingRule, 'body'),
  (req: Request, res: Response) => getController().updateRoutingRule(req, res)
);

/**
 * DELETE /api/v2/tickets/routing/rules/:ruleId
 * Delete a routing rule
 */
router.delete(
  '/routing/rules/:ruleId',
  validateSchema(ticketSchemas.routingRuleIdParam, 'params'),
  (req: Request, res: Response) => getController().deleteRoutingRule(req, res)
);

/**
 * POST /api/v2/tickets/routing/test
 * Test a routing rule against sample ticket payload
 */
router.post(
  '/routing/test',
  validateSchema(ticketSchemas.testRoutingRule, 'body'),
  (req: Request, res: Response) => getController().testRoutingRule(req, res)
);

/**
 * GET /api/v2/tickets/by-number/:ticketNumber
 * Get ticket by ticket number (not UUID)
 * Requires: valid ticket number
 */
router.get('/by-number/:ticketNumber', (req: Request, res: Response) =>
  getController().getTicketByNumber(req, res)
);

// ==================== CRUD OPERATIONS ====================

/**
 * GET /api/v2/tickets
 * List organization tickets
 * Query parameters: filters, sorting, pagination
 */
router.get('/', validateSchema(ticketSchemas.query, 'query'), (req: Request, res: Response) =>
  getController().listTickets(req, res)
);

/**
 * POST /api/v2/tickets
 * Create a new support ticket
 * Request body: ticket creation data
 */
router.post('/', validateSchema(ticketSchemas.create, 'body'), (req: Request, res: Response) =>
  getController().createTicket(req, res)
);

/**
 * GET /api/v2/tickets/:id
 * Get a specific ticket by ID
 * Requires: valid UUID for ticket ID
 */
router.get('/:id', validateSchema(paramSchemas.id, 'params'), (req: Request, res: Response) =>
  getController().getTicket(req, res)
);

/**
 * PUT /api/v2/tickets/:id
 * Update a ticket
 * Request body: ticket update data
 * Requires: valid UUID for ticket ID
 */
router.put(
  '/:id',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(ticketSchemas.update, 'body'),
  (req: Request, res: Response) => getController().updateTicket(req, res)
);

/**
 * DELETE /api/v2/tickets/:id
 * Delete a ticket
 * Requires: valid UUID for ticket ID
 */
router.delete('/:id', validateSchema(paramSchemas.id, 'params'), (req: Request, res: Response) =>
  getController().deleteTicket(req, res)
);

// ==================== MESSAGE OPERATIONS ====================

/**
 * POST /api/v2/tickets/:id/messages
 * Add a message/comment to a ticket
 * Request body: message content
 * Requires: valid UUID for ticket ID
 */
router.post(
  '/:id/messages',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(ticketSchemas.addMessage, 'body'),
  (req: Request, res: Response) => getController().addMessage(req, res)
);

// ==================== ASSIGNMENT OPERATIONS ====================

/**
 * PUT /api/v2/tickets/:id/assign
 * Assign ticket to a user
 * Request body: { assignedTo: userId }
 * Requires: valid UUID for ticket ID
 */
router.put(
  '/:id/assign',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(ticketSchemas.assign, 'body'),
  (req: Request, res: Response) => getController().assignTicket(req, res)
);

// ==================== STATUS OPERATIONS ====================

/**
 * PUT /api/v2/tickets/:id/resolve
 * Resolve/close a ticket
 * Request body: { resolution: string }
 * Requires: valid UUID for ticket ID
 */
router.put(
  '/:id/resolve',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(ticketSchemas.resolve, 'body'),
  (req: Request, res: Response) => getController().resolveTicket(req, res)
);

/**
 * PUT /api/v2/tickets/:id/close
 * Close a ticket
 * Requires: valid UUID for ticket ID
 */
router.put('/:id/close', validateSchema(paramSchemas.id, 'params'), (req: Request, res: Response) =>
  getController().closeTicket(req, res)
);

/**
 * PUT /api/v2/tickets/:id/reopen
 * Reopen a closed ticket
 * Requires: valid UUID for ticket ID
 */
router.put(
  '/:id/reopen',
  validateSchema(paramSchemas.id, 'params'),
  (req: Request, res: Response) => getController().reopenTicket(req, res)
);

// ==================== FEEDBACK OPERATIONS ====================

/**
 * POST /api/v2/tickets/:id/feedback
 * Add satisfaction rating and feedback
 * Request body: { rating: number, feedback?: string }
 * Requires: valid UUID for ticket ID
 */
router.post(
  '/:id/feedback',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(ticketSchemas.feedback, 'body'),
  (req: Request, res: Response) => getController().addFeedback(req, res)
);

export { router };
