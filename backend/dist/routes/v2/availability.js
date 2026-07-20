"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const availabilityController_1 = require("../../controllers/v2/availabilityController");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
exports.router = router;
const controller = new availabilityController_1.AvailabilityControllerV2();
router.put('/organizations/:orgId/availability', auth_1.authenticate, controller.setMyAvailability.bind(controller));
router.get('/organizations/:orgId/availability/me', auth_1.authenticate, controller.getMyAvailability.bind(controller));
router.get('/organizations/:orgId/availability/heatmap', auth_1.authenticate, controller.getGroupHeatmap.bind(controller));
router.get('/organizations/:orgId/availability/best-times', auth_1.authenticate, controller.getBestTimes.bind(controller));
//# sourceMappingURL=availability.js.map