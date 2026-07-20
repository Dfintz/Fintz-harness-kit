"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const shipLoanController_1 = require("../../controllers/v2/shipLoanController");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
exports.router = router;
const controller = new shipLoanController_1.ShipLoanControllerV2();
router.post('/ship-loans', auth_1.authenticate, controller.requestLoan.bind(controller));
router.get('/ship-loans', auth_1.authenticate, controller.getLoans.bind(controller));
router.get('/ship-loans/organization/:orgId', auth_1.authenticate, controller.getOrgLoanHistory.bind(controller));
router.get('/ship-loans/:id', auth_1.authenticate, controller.getLoanById.bind(controller));
router.post('/ship-loans/:id/approve', auth_1.authenticate, controller.approveLoan.bind(controller));
router.post('/ship-loans/:id/activate', auth_1.authenticate, controller.activateLoan.bind(controller));
router.post('/ship-loans/:id/return', auth_1.authenticate, controller.returnShip.bind(controller));
router.post('/ship-loans/:id/decline', auth_1.authenticate, controller.declineLoan.bind(controller));
//# sourceMappingURL=shipLoans.js.map