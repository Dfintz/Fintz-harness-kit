/**
 * API v2 - Ship Loadout Routes
 * Ship loadout management endpoints with standardized responses
 */

import { Router } from 'express';

import { ShipLoadoutControllerV2 } from '../../controllers/v2/shipLoadoutController';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new ShipLoadoutControllerV2();

// Loadout CRUD operations
router.post('/loadouts', authenticate, controller.createLoadout.bind(controller));

router.get('/loadouts/popular', authenticate, controller.getPopularLoadouts.bind(controller));

router.get('/loadouts/ship/:shipName', authenticate, controller.getLoadoutsByShip.bind(controller));

router.get(
  '/loadouts/owner/:ownerId',
  authenticate,
  controller.getLoadoutsByOwner.bind(controller)
);

router.get('/loadouts/shared/:userId', authenticate, controller.getSharedLoadouts.bind(controller));

router.get(
  '/loadouts/compare/:id1/:id2',
  authenticate,
  controller.compareLoadouts.bind(controller)
);

router.get('/loadouts/:id', authenticate, controller.getLoadout.bind(controller));

router.get('/loadouts/:id/history', authenticate, controller.getVersionHistory.bind(controller));

router.put('/loadouts/:id', authenticate, controller.updateLoadout.bind(controller));

router.delete('/loadouts/:id', authenticate, controller.deleteLoadout.bind(controller));

// Loadout versioning
router.post('/loadouts/:id/version', authenticate, controller.createVersion.bind(controller));

// Loadout sharing
router.post('/loadouts/:id/share', authenticate, controller.shareWithUsers.bind(controller));

router.put(
  '/loadouts/:id/sharing',
  authenticate,
  controller.updateSharingSettings.bind(controller)
);

router.post(
  '/loadouts/:id/share-orgs',
  authenticate,
  controller.shareWithOrganizations.bind(controller)
);

router.delete(
  '/loadouts/:id/share-orgs',
  authenticate,
  controller.unshareFromOrganizations.bind(controller)
);

// User loadouts
router.get('/users/:userId/loadouts', authenticate, controller.getLoadoutsForUser.bind(controller));

// Erkul.games integration
router.post('/loadouts/parse-erkul', authenticate, controller.parseErkulUrl.bind(controller));

router.get('/loadouts/:id/erkul-url', authenticate, controller.generateErkulUrl.bind(controller));

router.put('/loadouts/:id/erkul-url', authenticate, controller.updateErkulUrl.bind(controller));

export { router };
