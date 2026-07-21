/**
 * API v2 - Ship Loan Routes
 * Ship loan management endpoints with standardized responses
 */

import { Router } from 'express';

import { ShipLoanControllerV2 } from '../../controllers/v2/shipLoanController';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new ShipLoanControllerV2();

// Ship loan CRUD
router.post('/ship-loans', authenticate, controller.requestLoan.bind(controller));

router.get('/ship-loans', authenticate, controller.getLoans.bind(controller));

// Organization loan history — must come BEFORE :id to avoid matching "organization" as an ID
router.get(
  '/ship-loans/organization/:orgId',
  authenticate,
  controller.getOrgLoanHistory.bind(controller)
);

router.get('/ship-loans/:id', authenticate, controller.getLoanById.bind(controller));

// Ship loan management
router.post('/ship-loans/:id/approve', authenticate, controller.approveLoan.bind(controller));

router.post('/ship-loans/:id/activate', authenticate, controller.activateLoan.bind(controller));

router.post('/ship-loans/:id/return', authenticate, controller.returnShip.bind(controller));

router.post('/ship-loans/:id/decline', authenticate, controller.declineLoan.bind(controller));

export { router };
