/**
 * API v2 - Event Waitlist Routes
 * Event waitlist management endpoints with standardized responses
 */

import { Router } from 'express';

import { EventWaitlistControllerV2 } from '../../controllers/v2/eventWaitlistController';
import { authenticate } from '../../middleware/auth';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';

const router = Router();
const controller = new EventWaitlistControllerV2();

// All event waitlist routes require authentication and organization context
const orgScoped = [authenticate, tenantContextMiddleware, requireTenantContext] as const;

// Waitlist management
router.post('/activities/:id/waitlist', [...orgScoped], controller.joinWaitlist.bind(controller));

router.delete(
  '/activities/:id/waitlist',
  [...orgScoped],
  controller.leaveWaitlist.bind(controller)
);

router.get('/activities/:id/waitlist', [...orgScoped], controller.getWaitlist.bind(controller));

router.post(
  '/activities/:id/waitlist/promote',
  [...orgScoped],
  controller.promoteFromWaitlist.bind(controller)
);

export { router };
