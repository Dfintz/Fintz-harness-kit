"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const shipMaintenanceController_1 = require("../../controllers/v2/shipMaintenanceController");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
exports.router = router;
const controller = new shipMaintenanceController_1.ShipMaintenanceControllerV2();
router.post('/ship-maintenance', auth_1.authenticate, controller.scheduleMaintenance.bind(controller));
router.get('/ship-maintenance', auth_1.authenticate, controller.getMaintenanceSchedules.bind(controller));
router.get('/ship-maintenance/upcoming', auth_1.authenticate, controller.getUpcomingMaintenance.bind(controller));
router.get('/ship-maintenance/overdue', auth_1.authenticate, controller.getOverdueMaintenance.bind(controller));
router.get('/ship-maintenance/:id', auth_1.authenticate, controller.getMaintenanceById.bind(controller));
router.put('/ship-maintenance/:id/status', auth_1.authenticate, controller.updateMaintenanceStatus.bind(controller));
//# sourceMappingURL=shipMaintenance.js.map