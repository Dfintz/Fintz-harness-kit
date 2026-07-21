/**
 * API v2 - Event Conflict Routes
 * Event conflict detection and management endpoints with standardized responses
 */

import { Router } from 'express';

import { EventConflictControllerV2 } from '../../controllers/v2/eventConflictController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { eventConflictV2QuerySchemas } from '../../schemas';

const router = Router();
const controller = new EventConflictControllerV2();

// All event conflict routes require authentication and organization context
const orgScoped = [authenticate, tenantContextMiddleware, requireTenantContext] as const;

// Conflict detection
router.post(
  '/events/conflicts/check',
  [...orgScoped, validateSchema(eventConflictV2QuerySchemas.checkConflictsBody, 'body')],
  controller.checkConflicts.bind(controller)
);

router.get(
  '/events/conflicts/me',
  [...orgScoped, validateSchema(eventConflictV2QuerySchemas.myConflictsQuery, 'query')],
  controller.getMyConflicts.bind(controller)
);

router.get(
  '/events/conflicts/activity/:activityId',
  [
    ...orgScoped,
    validateSchema(eventConflictV2QuerySchemas.activityIdParam, 'params'),
    validateSchema(eventConflictV2QuerySchemas.activityConflictsQuery, 'query'),
  ],
  controller.getActivityConflicts.bind(controller)
);

router.get(
  '/events/conflicts/user/:userId',
  [
    ...orgScoped,
    validateSchema(eventConflictV2QuerySchemas.userIdParam, 'params'),
    validateSchema(eventConflictV2QuerySchemas.userConflictsQuery, 'query'),
  ],
  controller.getUserConflicts.bind(controller)
);

router.get(
  '/events/conflicts/range',
  [...orgScoped, validateSchema(eventConflictV2QuerySchemas.rangeQuery, 'query')],
  controller.getConflictsInRange.bind(controller)
);

export { router };
