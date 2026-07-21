/**
 * API v2 — Focus Routes (Sprint 18-E)
 * User and organization gameplay focus preferences
 */

import { Router } from 'express';

import { FocusControllerV2 } from '../../controllers/v2/focusController';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new FocusControllerV2();

// Get available focus values (public reference)
router.get('/focuses', authenticate, controller.getFocusList.bind(controller));

// User focuses
router.put('/users/me/focuses', authenticate, controller.setUserFocus.bind(controller));
router.get('/users/me/focuses', authenticate, controller.getUserFocus.bind(controller));

// Organization focuses
router.put('/organizations/:orgId/focuses', authenticate, controller.setOrgFocus.bind(controller));
router.get('/organizations/:orgId/focuses', authenticate, controller.getOrgFocus.bind(controller));

export { router };
